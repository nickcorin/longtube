import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Window } from 'happy-dom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const compatScript = readFileSync(join(__dirname, '../../src/browser-compat.js'), 'utf8');

const ORIGINAL_GLOBALS = {
  window: global.window,
  document: global.document,
  navigator: global.navigator,
  chrome: global.chrome,
  browser: global.browser,
};

const createChromeApi = () => {
  const storageData = {};

  const storageArea = {
    get(keys, callback) {
      const keyArray = Array.isArray(keys) ? keys : [keys];
      const result = {};

      keyArray.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(storageData, key)) {
          result[key] = storageData[key];
        }
      });

      if (callback) {
        callback(result);
        return undefined;
      }

      return Promise.resolve(result);
    },

    set(items, callback) {
      Object.assign(storageData, items);
      if (callback) {
        callback();
        return undefined;
      }
      return Promise.resolve();
    },

    remove(keys, callback) {
      const keyArray = Array.isArray(keys) ? keys : [keys];
      keyArray.forEach((key) => delete storageData[key]);
      if (callback) {
        callback();
        return undefined;
      }
      return Promise.resolve();
    },

    clear(callback) {
      Object.keys(storageData).forEach((key) => delete storageData[key]);
      if (callback) {
        callback();
        return undefined;
      }
      return Promise.resolve();
    },
  };

  return {
    storageData,
    api: {
      storage: {
        local: storageArea,
        onChanged: {
          addListener: () => {},
          removeListener: () => {},
        },
      },
      runtime: {
        lastError: null,
        sendMessage: (_message, callback) => {
          if (callback) callback({ ok: true });
        },
        onMessage: {
          addListener: () => {},
          removeListener: () => {},
        },
        getURL: (path) => `chrome-extension://test/${path}`,
        getManifest: () => ({ name: 'LongTube' }),
      },
      tabs: {
        query: (_queryInfo, callback) => {
          if (callback) callback([{ id: 1 }]);
        },
        sendMessage: (_tabId, _message, callback) => {
          if (callback) callback({ ok: true });
        },
        create: (_props, callback) => {
          if (callback) callback({ id: 2 });
        },
        update: (_tabId, _props, callback) => {
          if (callback) callback({ id: 1 });
        },
        remove: (_tabId, callback) => {
          if (callback) callback();
        },
      },
    },
  };
};

const createFirefoxApi = () => {
  const storageData = {};
  let lastGetArgLength = 0;

  return {
    storageData,
    getLastGetArgLength: () => lastGetArgLength,
    api: {
      storage: {
        local: {
          get(...args) {
            lastGetArgLength = args.length;
            const keys = args[0];
            const keyArray = Array.isArray(keys) ? keys : [keys];
            const result = {};

            keyArray.forEach((key) => {
              if (Object.prototype.hasOwnProperty.call(storageData, key)) {
                result[key] = storageData[key];
              }
            });

            return Promise.resolve(result);
          },
          set(items) {
            Object.assign(storageData, items);
            return Promise.resolve();
          },
          remove(keys) {
            const keyArray = Array.isArray(keys) ? keys : [keys];
            keyArray.forEach((key) => delete storageData[key]);
            return Promise.resolve();
          },
          clear() {
            Object.keys(storageData).forEach((key) => delete storageData[key]);
            return Promise.resolve();
          },
        },
        onChanged: {
          addListener: () => {},
          removeListener: () => {},
        },
      },
      runtime: {
        lastError: null,
        sendMessage: () => Promise.resolve({ ok: true }),
        onMessage: {
          addListener: () => {},
          removeListener: () => {},
        },
        getURL: (path) => `moz-extension://test/${path}`,
        getManifest: () => ({ name: 'LongTube' }),
      },
      tabs: {
        query: () => Promise.resolve([{ id: 1 }]),
        sendMessage: () => Promise.resolve({ ok: true }),
        create: () => Promise.resolve({ id: 2 }),
        update: () => Promise.resolve({ id: 1 }),
        remove: () => Promise.resolve(),
      },
    },
  };
};

const installGlobals = ({ userAgent, chromeApi, browserApi, navigatorExtras = {} }) => {
  const testWindow = new Window();
  global.window = testWindow;
  global.document = testWindow.document;
  global.navigator = { userAgent, ...navigatorExtras };

  if (chromeApi) {
    global.chrome = chromeApi;
  } else {
    delete global.chrome;
  }

  if (browserApi) {
    global.browser = browserApi;
  } else {
    delete global.browser;
  }
};

const restoreGlobals = () => {
  global.window = ORIGINAL_GLOBALS.window;
  global.document = ORIGINAL_GLOBALS.document;
  global.navigator = ORIGINAL_GLOBALS.navigator;

  if (ORIGINAL_GLOBALS.chrome) {
    global.chrome = ORIGINAL_GLOBALS.chrome;
  } else {
    delete global.chrome;
  }

  if (ORIGINAL_GLOBALS.browser) {
    global.browser = ORIGINAL_GLOBALS.browser;
  } else {
    delete global.browser;
  }
};

describe('Browser Compatibility Layer', () => {
  beforeEach(() => {
    restoreGlobals();
  });

  afterEach(() => {
    restoreGlobals();
  });

  test('wraps callback-based Chrome APIs with Promise-based methods', async () => {
    const { api: chromeApi, storageData } = createChromeApi();
    installGlobals({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      chromeApi,
    });

    eval(compatScript);

    expect(window.browserCompat.browser.name).toBe('chrome');

    await window.browserCompat.storage.local.set({ enabled: false, totalBlockedCount: 3 });
    const result = await window.browserCompat.storage.local.get(['enabled', 'totalBlockedCount']);

    expect(result.enabled).toBe(false);
    expect(result.totalBlockedCount).toBe(3);
    expect(storageData.enabled).toBe(false);
    expect(storageData.totalBlockedCount).toBe(3);
  });

  test('uses native Promise APIs in Firefox without injecting callback args', async () => {
    const firefox = createFirefoxApi();
    firefox.storageData.enabled = true;

    installGlobals({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0',
      browserApi: firefox.api,
    });

    eval(compatScript);

    const result = await window.browserCompat.storage.local.get(['enabled']);
    expect(window.browserCompat.browser.name).toBe('firefox');
    expect(result.enabled).toBe(true);
    expect(firefox.getLastGetArgLength()).toBe(1);
  });

  test('exposes feature flags for detected browser/API surface', () => {
    const firefox = createFirefoxApi();
    firefox.api.webRequest = { onBeforeRequest: {} };

    installGlobals({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0',
      browserApi: firefox.api,
      navigatorExtras: { serviceWorker: {} },
    });

    eval(compatScript);

    expect(window.browserCompat.features.hasWebRequestBlocking()).toBe(true);
    expect(window.browserCompat.features.hasServiceWorker()).toBe(false);
  });

  test('fails gracefully when no extension API is available', () => {
    installGlobals({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    });

    const originalError = console.error;
    const errors = [];
    console.error = (...args) => errors.push(args.join(' '));

    try {
      eval(compatScript);
      expect(window.browserCompat).toBeUndefined();
      expect(
        errors.some((line) => line.includes('Failed to initialize browser compatibility layer'))
      ).toBe(true);
    } finally {
      console.error = originalError;
    }
  });
});
