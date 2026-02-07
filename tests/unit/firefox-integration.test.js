import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Window } from 'happy-dom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const compatScript = readFileSync(join(__dirname, '../../src/browser-compat.js'), 'utf8');
const contentScript = readFileSync(join(__dirname, '../../src/content.js'), 'utf8');
const popupScript = readFileSync(join(__dirname, '../../src/popup.js'), 'utf8');

const waitForAsyncWork = async () => {
  await new Promise((resolve) => setTimeout(resolve, 45));
};

const ORIGINAL_GLOBALS = {
  window: global.window,
  document: global.document,
  navigator: global.navigator,
  location: global.location,
  browser: global.browser,
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

const createFirefoxBrowserApi = (
  initialStorage = {},
  tabs = [{ id: 1, url: 'https://www.youtube.com/' }]
) => {
  const storageData = {
    enabled: true,
    totalBlockedCount: 0,
    sessionStartCount: 0,
    theme: 'light',
    ...initialStorage,
  };
  const storageListeners = [];
  const runtimeListeners = [];
  const sentMessages = [];

  const getStorage = (keys) => {
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

  const setStorage = (items) => {
    const previous = { ...storageData };
    Object.assign(storageData, items);

    const changes = {};
    Object.keys(items).forEach((key) => {
      changes[key] = {
        oldValue: previous[key],
        newValue: storageData[key],
      };
    });
    storageListeners.forEach((listener) => listener(changes, 'local'));
  };

  const api = {
    storage: {
      local: {
        get: async (keys) => getStorage(keys),
        set: async (items) => {
          setStorage(items);
        },
        remove: async () => {},
        clear: async () => {
          Object.keys(storageData).forEach((key) => delete storageData[key]);
        },
      },
      onChanged: {
        addListener: (listener) => storageListeners.push(listener),
        removeListener: (listener) => {
          const index = storageListeners.indexOf(listener);
          if (index >= 0) storageListeners.splice(index, 1);
        },
      },
    },
    runtime: {
      lastError: null,
      sendMessage: async () => {},
      onMessage: {
        addListener: (listener) => runtimeListeners.push(listener),
        removeListener: (listener) => {
          const index = runtimeListeners.indexOf(listener);
          if (index >= 0) runtimeListeners.splice(index, 1);
        },
      },
      getURL: (path) => `moz-extension://test/${path}`,
      getManifest: () => ({ name: 'LongTube' }),
    },
    tabs: {
      query: async () => tabs,
      sendMessage: async (tabId, message) => {
        sentMessages.push({ tabId, message });
        runtimeListeners.forEach((listener) => {
          listener(message, { tab: { id: tabId } }, () => {});
        });
      },
      create: async () => ({ id: 99 }),
      update: async () => ({ id: 1 }),
      remove: async () => {},
    },
  };

  return { api, storageData, sentMessages };
};

describe('Firefox Extension Integration', () => {
  beforeEach(() => {
    const testWindow = new Window();
    global.window = testWindow;
    global.document = testWindow.document;
    global.location = testWindow.location;
    global.HTMLElement = testWindow.HTMLElement;
    const MutationObserverImpl = testWindow.MutationObserver || createMutationObserverFallback();
    global.MutationObserver = MutationObserverImpl;
    testWindow.MutationObserver = MutationObserverImpl;
    global.navigator = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0',
    };
    delete global.chrome;
  });

  afterEach(() => {
    global.window = ORIGINAL_GLOBALS.window;
    global.document = ORIGINAL_GLOBALS.document;
    global.navigator = ORIGINAL_GLOBALS.navigator;
    global.location = ORIGINAL_GLOBALS.location;
    global.browser = ORIGINAL_GLOBALS.browser;
    global.chrome = ORIGINAL_GLOBALS.chrome;
    global.MutationObserver = ORIGINAL_GLOBALS.mutationObserver;
  });

  test('browser-compat initializes with Firefox detection and Promise wrappers', async () => {
    const { api, storageData } = createFirefoxBrowserApi({ enabled: true, totalBlockedCount: 2 });
    global.browser = api;

    eval(compatScript);

    expect(window.browserCompat).toBeDefined();
    expect(window.browserCompat.browser.name).toBe('firefox');

    const stored = await window.browserCompat.storage.local.get(['enabled', 'totalBlockedCount']);
    expect(stored.enabled).toBe(true);
    expect(stored.totalBlockedCount).toBe(2);

    await window.browserCompat.storage.local.set({ enabled: false });
    expect(storageData.enabled).toBe(false);
  });

  test('content script removes Shorts and updates storage via compatibility layer', async () => {
    const { api, storageData } = createFirefoxBrowserApi({ enabled: true, totalBlockedCount: 0 });
    global.browser = api;

    document.documentElement.innerHTML = '<head></head><body></body>';
    document.body.innerHTML = `
      <ytd-video-renderer id="short-video">
        <a href="/shorts/abc123">Shorts Video</a>
      </ytd-video-renderer>
      <ytd-video-renderer id="regular-video">
        <a href="/watch?v=xyz">Regular Video</a>
      </ytd-video-renderer>
    `;

    eval(compatScript);
    eval(contentScript);
    await waitForAsyncWork();
    await waitForAsyncWork();

    expect(document.getElementById('longtube-blocking-styles')).toBeTruthy();
    expect(document.documentElement.classList.contains('longtube-active')).toBe(true);
    expect(document.getElementById('short-video')).toBeNull();
    expect(document.getElementById('regular-video')).toBeTruthy();
    expect(storageData.totalBlockedCount).toBeGreaterThan(0);
  });

  test('popup script reads Firefox storage and sends toggle messages', async () => {
    const { api, storageData, sentMessages } = createFirefoxBrowserApi({
      enabled: true,
      totalBlockedCount: 5,
      sessionStartCount: 1,
      theme: 'light',
    });
    global.browser = api;

    document.body.innerHTML = `
      <button id="themeToggle"></button>
      <button id="toggle" class="switch active" role="switch" aria-checked="true"></button>
      <div id="totalBlocked">0</div>
      <div id="sessionBlocked">0</div>
      <div id="timeSaved">0 seconds</div>
      <button id="resetCount"></button>
    `;

    eval(compatScript);
    eval(popupScript);
    document.dispatchEvent(new window.Event('DOMContentLoaded'));
    await waitForAsyncWork();

    expect(document.getElementById('totalBlocked').textContent).toBe('5');
    expect(document.getElementById('sessionBlocked').textContent).toBe('4');

    document.getElementById('toggle').click();
    await waitForAsyncWork();

    expect(storageData.enabled).toBe(false);
    expect(sentMessages.some((message) => message.message.action === 'toggleBlocking')).toBe(true);
  });

  test('manifest-firefox.json keeps Firefox-specific metadata and script ordering', () => {
    const manifestPath = join(__dirname, '../../manifest-firefox.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

    expect(manifest.browser_specific_settings).toBeDefined();
    expect(manifest.browser_specific_settings.gecko.id).toBeDefined();
    expect(manifest.permissions).toContain('storage');
    expect(manifest.host_permissions).toContain('*://*.youtube.com/*');

    const contentScripts = manifest.content_scripts[0].js;
    expect(contentScripts[0]).toBe('src/browser-compat.js');
    expect(contentScripts[1]).toBe('src/content.js');
  });
});
