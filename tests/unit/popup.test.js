import { test, expect, describe, beforeEach } from 'bun:test';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Window } from 'happy-dom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const popupScript = readFileSync(join(__dirname, '../../src/popup.js'), 'utf8');

const renderPopupDOM = () => {
  document.body.innerHTML = `
    <button id="themeToggle"></button>
    <button id="toggle" class="switch active" role="switch" aria-checked="true"></button>
    <div id="totalBlocked">0</div>
    <div id="sessionBlocked">0</div>
    <div id="timeSaved">0 seconds</div>
    <button id="resetCount"></button>
  `;
};

const waitForAsyncWork = async () => {
  await new Promise((resolve) => setTimeout(resolve, 25));
};

const createBrowserCompatMock = (initialStorage = {}, tabs = [{ id: 1 }]) => {
  const storageData = { ...initialStorage };
  const storageListeners = [];
  const sentMessages = [];

  const storage = {
    local: {
      get: async (keys) => {
        if (!keys) return { ...storageData };

        const result = {};
        const requestedKeys = Array.isArray(keys) ? keys : [keys];

        requestedKeys.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(storageData, key)) {
            result[key] = storageData[key];
          }
        });

        return result;
      },
      set: async (items) => {
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
      },
    },
    onChanged: {
      addListener: (listener) => storageListeners.push(listener),
    },
  };

  const browserCompat = {
    storage,
    tabs: {
      query: async () => tabs,
      sendMessage: async (tabId, message) => {
        sentMessages.push({ tabId, message });
      },
    },
  };

  return { browserCompat, storageData, sentMessages };
};

describe('LongTube Popup', () => {
  beforeEach(() => {
    const testWindow = new Window();
    global.window = testWindow;
    global.document = testWindow.document;
    global.HTMLElement = testWindow.HTMLElement;
    global.MutationObserver = testWindow.MutationObserver;
    global.location = testWindow.location;

    document.documentElement.innerHTML = '<head></head><body></body>';
    document.documentElement.removeAttribute('data-theme');
    renderPopupDOM();
  });

  test('initializes UI from storage data', async () => {
    const { browserCompat } = createBrowserCompatMock({
      enabled: false,
      totalBlockedCount: 10,
      sessionStartCount: 4,
      theme: 'dark',
    });

    window.browserCompat = browserCompat;
    eval(popupScript);
    document.dispatchEvent(new window.Event('DOMContentLoaded'));
    await waitForAsyncWork();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.getElementById('toggle').classList.contains('active')).toBe(false);
    expect(document.getElementById('toggle').getAttribute('aria-checked')).toBe('false');
    expect(document.getElementById('totalBlocked').textContent).toBe('10');
    expect(document.getElementById('sessionBlocked').textContent).toBe('6');
    expect(document.getElementById('timeSaved').textContent).toBe('3 minutes');
  });

  test('toggles blocking state and sends tab messages', async () => {
    const tabs = [{ id: 10 }, { id: 20 }];
    const { browserCompat, storageData, sentMessages } = createBrowserCompatMock(
      {
        enabled: true,
        totalBlockedCount: 0,
        sessionStartCount: 0,
      },
      tabs
    );

    window.browserCompat = browserCompat;
    eval(popupScript);
    document.dispatchEvent(new window.Event('DOMContentLoaded'));
    await waitForAsyncWork();

    document.getElementById('toggle').click();
    await waitForAsyncWork();

    expect(storageData.enabled).toBe(false);
    expect(sentMessages.length).toBe(2);
    expect(sentMessages[0].message).toEqual({
      action: 'toggleBlocking',
      enabled: false,
    });
  });

  test('resets stored stats and updates UI', async () => {
    const { browserCompat, storageData } = createBrowserCompatMock({
      enabled: true,
      totalBlockedCount: 12,
      sessionStartCount: 5,
      theme: 'light',
    });

    window.browserCompat = browserCompat;
    eval(popupScript);
    document.dispatchEvent(new window.Event('DOMContentLoaded'));
    await waitForAsyncWork();

    document.getElementById('resetCount').click();
    await waitForAsyncWork();

    expect(storageData.totalBlockedCount).toBe(0);
    expect(storageData.sessionStartCount).toBe(0);
    expect(document.getElementById('totalBlocked').textContent).toBe('0');
    expect(document.getElementById('sessionBlocked').textContent).toBe('0');
    expect(document.getElementById('timeSaved').textContent).toBe('0 seconds');
  });
});
