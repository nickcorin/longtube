import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Window } from 'happy-dom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const contentScript = readFileSync(join(__dirname, '../../src/content.js'), 'utf8');
const popupScript = readFileSync(join(__dirname, '../../src/popup.js'), 'utf8');

const waitForAsyncWork = async () => {
  await new Promise((resolve) => setTimeout(resolve, 40));
};

const createApiHarness = (initialStorage = {}) => {
  const storageData = {
    enabled: true,
    totalBlockedCount: 0,
    sessionStartCount: 0,
    ...initialStorage,
  };
  const storageListeners = [];
  const runtimeListeners = [];
  const sentMessages = [];

  const getFromStorage = (keys) => {
    if (!keys) return { ...storageData };
    const keyArray = Array.isArray(keys) ? keys : [keys];
    const result = {};
    keyArray.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(storageData, key)) {
        result[key] = storageData[key];
      }
    });
    return result;
  };

  const setInStorage = (items) => {
    const previousData = { ...storageData };
    Object.assign(storageData, items);

    const changes = {};
    Object.keys(items).forEach((key) => {
      changes[key] = {
        oldValue: previousData[key],
        newValue: storageData[key],
      };
    });
    storageListeners.forEach((listener) => listener(changes, 'local'));
  };

  const sendMessageToContentScripts = async (tabId, message) => {
    sentMessages.push({ tabId, message });
    runtimeListeners.forEach((listener) => {
      listener(message, { tab: { id: tabId } }, () => {});
    });
  };

  const storageOnChanged = {
    addListener: (listener) => storageListeners.push(listener),
    removeListener: (listener) => {
      const index = storageListeners.indexOf(listener);
      if (index >= 0) storageListeners.splice(index, 1);
    },
  };

  const runtimeOnMessage = {
    addListener: (listener) => runtimeListeners.push(listener),
    removeListener: (listener) => {
      const index = runtimeListeners.indexOf(listener);
      if (index >= 0) runtimeListeners.splice(index, 1);
    },
  };

  return {
    storageData,
    sentMessages,
    chrome: {
      storage: {
        local: {
          get: (keys, callback) => {
            const result = getFromStorage(keys);
            if (callback) {
              callback(result);
              return undefined;
            }
            return Promise.resolve(result);
          },
          set: (items, callback) => {
            setInStorage(items);
            if (callback) {
              callback();
              return undefined;
            }
            return Promise.resolve();
          },
        },
        onChanged: storageOnChanged,
      },
      runtime: {
        onMessage: runtimeOnMessage,
        lastError: null,
      },
      tabs: {
        query: (_queryInfo, callback) => {
          const tabs = [{ id: 1, url: 'https://www.youtube.com/' }];
          if (callback) {
            callback(tabs);
            return undefined;
          }
          return Promise.resolve(tabs);
        },
        sendMessage: (tabId, message, callback) => {
          const promise = sendMessageToContentScripts(tabId, message);
          if (callback) {
            promise.then(() => callback()).catch(() => callback());
            return undefined;
          }
          return promise;
        },
      },
    },
    browserCompat: {
      storage: {
        local: {
          get: async (keys) => getFromStorage(keys),
          set: async (items) => setInStorage(items),
        },
        onChanged: storageOnChanged,
      },
      runtime: {
        onMessage: runtimeOnMessage,
      },
      tabs: {
        query: async () => [{ id: 1, url: 'https://www.youtube.com/' }],
        sendMessage: sendMessageToContentScripts,
      },
    },
  };
};

const renderPopupDOM = () => {
  document.body.innerHTML = `
    <button id="themeToggle"></button>
    <button id="toggle" class="switch active" role="switch" aria-checked="true"></button>
    <div id="totalBlocked">0</div>
    <div id="sessionBlocked">0</div>
    <div id="timeSaved">0 seconds</div>
    <button id="resetCount"></button>
    <section id="feed">
      <ytd-video-renderer id="shorts-video">
        <a href="/shorts/123">Shorts Video</a>
      </ytd-video-renderer>
      <ytd-video-renderer id="regular-video">
        <a href="/watch?v=456">Regular Video</a>
      </ytd-video-renderer>
    </section>
  `;
};

const ORIGINAL_GLOBALS = {
  window: global.window,
  document: global.document,
  location: global.location,
  chrome: global.chrome,
  mutationObserver: global.MutationObserver,
};

const createMutationObserverFallback = () => {
  return class MutationObserverFallback {
    constructor(callback) {
      this.callback = callback;
      this.target = null;
      this.listener = null;
    }

    observe(target) {
      this.target = target;
      this.listener = () => {
        setTimeout(() => {
          this.callback([{ type: 'childList', target }], this);
        }, 0);
      };
      target.addEventListener('DOMNodeInserted', this.listener);
    }

    disconnect() {
      if (this.target && this.listener) {
        this.target.removeEventListener('DOMNodeInserted', this.listener);
      }
    }
  };
};

describe('Popup-Content Integration', () => {
  let reloadCalled;
  let harness;

  beforeEach(() => {
    const testWindow = new Window();
    global.window = testWindow;
    global.document = testWindow.document;
    global.location = testWindow.location;
    global.HTMLElement = testWindow.HTMLElement;
    const MutationObserverImpl = testWindow.MutationObserver || createMutationObserverFallback();
    global.MutationObserver = MutationObserverImpl;
    testWindow.MutationObserver = MutationObserverImpl;

    try {
      window.location.href = 'https://www.youtube.com/';
    } catch {
      // Ignore URL assignment failures in test environment.
    }

    reloadCalled = false;
    try {
      window.location.reload = () => {
        reloadCalled = true;
      };
    } catch {
      Object.defineProperty(window.location, 'reload', {
        value: () => {
          reloadCalled = true;
        },
        configurable: true,
      });
    }

    harness = createApiHarness();
    global.chrome = harness.chrome;
    window.browserCompat = harness.browserCompat;

    renderPopupDOM();
  });

  afterEach(() => {
    global.window = ORIGINAL_GLOBALS.window;
    global.document = ORIGINAL_GLOBALS.document;
    global.location = ORIGINAL_GLOBALS.location;
    global.chrome = ORIGINAL_GLOBALS.chrome;
    global.MutationObserver = ORIGINAL_GLOBALS.mutationObserver;
  });

  test('propagates popup toggle message to content script and persists state', async () => {
    eval(contentScript);
    eval(popupScript);
    document.dispatchEvent(new window.Event('DOMContentLoaded'));
    await waitForAsyncWork();

    document.getElementById('toggle').click();
    await waitForAsyncWork();

    expect(harness.storageData.enabled).toBe(false);
    expect(reloadCalled).toBe(true);
    expect(harness.sentMessages.some((entry) => entry.message.action === 'toggleBlocking')).toBe(
      true
    );
  });

  test('updates popup counters after content script removes Shorts', async () => {
    eval(contentScript);
    eval(popupScript);
    document.dispatchEvent(new window.Event('DOMContentLoaded'));
    await waitForAsyncWork();
    await waitForAsyncWork();

    const totalBlocked = Number(document.getElementById('totalBlocked').textContent);
    const sessionBlocked = Number(document.getElementById('sessionBlocked').textContent);

    expect(harness.storageData.totalBlockedCount).toBeGreaterThan(0);
    expect(totalBlocked).toBe(harness.storageData.totalBlockedCount);
    expect(sessionBlocked).toBeGreaterThanOrEqual(0);
    expect(document.getElementById('shorts-video')).toBeNull();
    expect(document.getElementById('regular-video')).toBeTruthy();
  });

  test('resets counters in both popup and shared storage', async () => {
    harness = createApiHarness({
      enabled: true,
      totalBlockedCount: 12,
      sessionStartCount: 5,
      theme: 'light',
    });
    global.chrome = harness.chrome;
    window.browserCompat = harness.browserCompat;
    renderPopupDOM();

    eval(contentScript);
    eval(popupScript);
    document.dispatchEvent(new window.Event('DOMContentLoaded'));
    await waitForAsyncWork();

    document.getElementById('resetCount').click();
    await waitForAsyncWork();

    expect(harness.storageData.totalBlockedCount).toBe(0);
    expect(harness.storageData.sessionStartCount).toBe(0);
    expect(document.getElementById('totalBlocked').textContent).toBe('0');
    expect(document.getElementById('sessionBlocked').textContent).toBe('0');
    expect(document.getElementById('timeSaved').textContent).toBe('0 seconds');
  });
});
