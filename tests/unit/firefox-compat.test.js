import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Window } from 'happy-dom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const compatScript = readFileSync(join(__dirname, '../../src/browser-compat.js'), 'utf8');
const contentScript = readFileSync(join(__dirname, '../../src/content.js'), 'utf8');

const waitForAsyncWork = async () => {
  await new Promise((resolve) => setTimeout(resolve, 40));
};

const ORIGINAL_GLOBALS = {
  window: global.window,
  document: global.document,
  navigator: global.navigator,
  browser: global.browser,
  chrome: global.chrome,
  location: global.location,
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

const createFirefoxBrowserApi = (storageData = { enabled: true, totalBlockedCount: 0 }) => ({
  storage: {
    local: {
      get: (keys) => {
        const keyArray = Array.isArray(keys) ? keys : [keys];
        const result = {};
        keyArray.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(storageData, key)) {
            result[key] = storageData[key];
          }
        });
        return Promise.resolve(result);
      },
      set: (items) => {
        Object.assign(storageData, items);
        return Promise.resolve();
      },
      remove: () => Promise.resolve(),
      clear: () => Promise.resolve(),
    },
    onChanged: {
      addListener: () => {},
      removeListener: () => {},
    },
  },
  runtime: {
    lastError: null,
    sendMessage: () => Promise.resolve(),
    onMessage: {
      addListener: () => {},
      removeListener: () => {},
    },
    getURL: (path) => `moz-extension://test/${path}`,
    getManifest: () => ({ name: 'LongTube' }),
  },
  tabs: {
    query: () => Promise.resolve([{ id: 1 }]),
    sendMessage: () => Promise.resolve(),
    create: () => Promise.resolve({ id: 2 }),
    update: () => Promise.resolve({ id: 1 }),
    remove: () => Promise.resolve(),
  },
});

/**
 * Tests to ensure Firefox compatibility
 */
describe('Firefox Compatibility', () => {
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
    global.browser = ORIGINAL_GLOBALS.browser;
    global.chrome = ORIGINAL_GLOBALS.chrome;
    global.location = ORIGINAL_GLOBALS.location;
    global.MutationObserver = ORIGINAL_GLOBALS.mutationObserver;
  });

  test('browser-compat initializes in Firefox environment with Promise-based APIs', async () => {
    const storageData = { enabled: true, totalBlockedCount: 4 };
    global.browser = createFirefoxBrowserApi(storageData);

    eval(compatScript);

    expect(window.browserCompat).toBeDefined();
    expect(window.browserCompat.browser.name).toBe('firefox');

    const result = await window.browserCompat.storage.local.get(['enabled', 'totalBlockedCount']);
    expect(result.enabled).toBe(true);
    expect(result.totalBlockedCount).toBe(4);

    await window.browserCompat.storage.local.set({ enabled: false });
    expect(storageData.enabled).toBe(false);
  });

  test('content script runs with browserCompat and removes Shorts without chrome namespace', async () => {
    const storageData = { enabled: true, totalBlockedCount: 0 };
    global.browser = createFirefoxBrowserApi(storageData);

    document.documentElement.innerHTML = '<head></head><body></body>';
    document.body.innerHTML = `
      <ytd-video-renderer id="short-video">
        <a href="/shorts/123">Shorts</a>
      </ytd-video-renderer>
      <ytd-video-renderer id="regular-video">
        <a href="/watch?v=abc">Regular</a>
      </ytd-video-renderer>
    `;

    eval(compatScript);
    eval(contentScript);
    await waitForAsyncWork();
    await waitForAsyncWork();

    expect(document.getElementById('longtube-blocking-styles')).toBeTruthy();
    expect(document.getElementById('short-video')).toBeNull();
    expect(document.getElementById('regular-video')).toBeTruthy();
    expect(storageData.totalBlockedCount).toBeGreaterThan(0);
  });

  test('manifest-firefox.json loads browser-compat.js before content.js', () => {
    const manifestPath = join(__dirname, '../../manifest-firefox.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

    const contentScripts = manifest.content_scripts[0].js;
    const compatIndex = contentScripts.indexOf('src/browser-compat.js');
    const contentIndex = contentScripts.indexOf('src/content.js');

    // browser-compat.js must be loaded before content.js
    expect(compatIndex).toBeGreaterThanOrEqual(0);
    expect(contentIndex).toBeGreaterThanOrEqual(0);
    expect(compatIndex).toBeLessThan(contentIndex);
  });
});
