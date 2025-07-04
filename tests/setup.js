/**
 * Test environment setup for the LongTube extension test suite.
 * This file configures a DOM environment using happy-dom and provides
 * mock implementations of browser APIs required for testing both Chrome and Firefox.
 */

import { test } from 'bun:test';
import { Window } from 'happy-dom';

const window = new Window();
const document = window.document;

// Make DOM globals available in the test environment.
global.window = window;
global.document = document;
global.HTMLElement = window.HTMLElement;

// Provide a MutationObserver implementation if not available in happy-dom.
// This ensures tests can verify DOM observation functionality.
if (!window.MutationObserver) {
  class MutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.observing = false;
    }

    observe(target, options) {
      this.observing = true;
      this.target = target;
      this.options = options;

      // Simulate DOM observation by listening for DOM insertion events.
      // Callbacks are triggered asynchronously to mimic real browser behavior.
      if (target && target.addEventListener) {
        this._listener = () => {
          setTimeout(() => {
            if (this.observing && this.callback) {
              this.callback([{ type: 'childList', target }], this);
            }
          }, 0);
        };
        target.addEventListener('DOMNodeInserted', this._listener);
      }
    }

    disconnect() {
      this.observing = false;
      if (this.target && this._listener) {
        this.target.removeEventListener('DOMNodeInserted', this._listener);
      }
    }
  }

  global.MutationObserver = MutationObserver;
  window.MutationObserver = MutationObserver;
  Window.prototype.MutationObserver = MutationObserver;
}

// Storage mock that works for both Chrome and Firefox styles.
class StorageMock {
  constructor() {
    this.data = {};
  }

  get(keys, callback) {
    const result = {};
    const keyArray = Array.isArray(keys) ? keys : [keys];

    keyArray.forEach((key) => {
      if (this.data[key] !== undefined) {
        result[key] = this.data[key];
      }
    });

    // Support both callback style (Chrome) and Promise style (Firefox).
    if (callback) {
      setTimeout(() => callback(result), 0);
      return undefined;
    }
    return Promise.resolve(result);
  }

  set(items, callback) {
    Object.assign(this.data, items);

    // Trigger storage change listeners.
    if (this.onChangedListeners) {
      const changes = {};
      Object.keys(items).forEach((key) => {
        changes[key] = { newValue: items[key], oldValue: this.data[key] };
      });
      this.onChangedListeners.forEach((listener) => {
        setTimeout(() => listener(changes, 'local'), 0);
      });
    }

    // Support both callback style (Chrome) and Promise style (Firefox).
    if (callback) {
      setTimeout(() => callback(), 0);
      return undefined;
    }
    return Promise.resolve();
  }

  clear(callback) {
    this.data = {};
    if (callback) {
      setTimeout(() => callback(), 0);
      return undefined;
    }
    return Promise.resolve();
  }
}

// Create storage change listener support.
const storageOnChangedListeners = [];

// Chrome-style API mock.
global.chrome = {
  storage: {
    local: new StorageMock(),
    onChanged: {
      addListener: (callback) => {
        storageOnChangedListeners.push(callback);
        if (!global.chrome.storage.local.onChangedListeners) {
          global.chrome.storage.local.onChangedListeners = [];
        }
        global.chrome.storage.local.onChangedListeners.push(callback);
      },
      removeListener: (callback) => {
        const index = storageOnChangedListeners.indexOf(callback);
        if (index > -1) {
          storageOnChangedListeners.splice(index, 1);
        }
      },
    },
  },
  runtime: {
    onMessage: {
      addListener: () => {},
      removeListener: () => {},
    },
    lastError: null,
  },
  tabs: {
    query: (queryInfo, callback) => {
      const mockTabs = [{ id: 1, url: 'https://www.youtube.com/' }];
      if (callback) {
        setTimeout(() => callback(mockTabs), 0);
        return undefined;
      }
      return Promise.resolve(mockTabs);
    },
    sendMessage: (tabId, message, callback) => {
      if (callback) {
        setTimeout(() => callback(), 0);
        return undefined;
      }
      return Promise.resolve();
    },
  },
};

// Firefox-style API mock (Promise-based).
global.browser = {
  storage: {
    local: {
      get: (keys) => global.chrome.storage.local.get(keys),
      set: (items) => global.chrome.storage.local.set(items),
      clear: () => global.chrome.storage.local.clear(),
    },
    onChanged: {
      addListener: global.chrome.storage.onChanged.addListener,
      removeListener: global.chrome.storage.onChanged.removeListener,
    },
  },
  runtime: {
    onMessage: {
      addListener: () => {},
      removeListener: () => {},
    },
  },
  tabs: {
    query: (queryInfo) => global.chrome.tabs.query(queryInfo),
    sendMessage: (tabId, message) => global.chrome.tabs.sendMessage(tabId, message),
  },
};

// Helper function to set up browser environment for tests.
export function setupBrowserEnvironment(browserType = 'chrome') {
  // Reset storage data.
  global.chrome.storage.local.data = {};

  // Set up browserCompat based on browser type.
  if (browserType === 'firefox') {
    // Simulate Firefox environment with browser API.
    window.browserCompat = {
      browser: { name: 'firefox', engine: 'gecko' },
      storage: {
        local: global.browser.storage.local,
        onChanged: global.browser.storage.onChanged,
      },
      runtime: global.browser.runtime,
      tabs: global.browser.tabs,
    };
  } else {
    // For Chrome, browserCompat is not needed (fallback to chrome API).
    delete window.browserCompat;
  }

  // Make browserCompat available globally for tests.
  global.browserCompat = window.browserCompat;
}

// Helper to test with both browsers.
export function testWithBrowsers(testName, testFn) {
  ['chrome', 'firefox'].forEach((browser) => {
    test(`${testName} (${browser})`, () => {
      setupBrowserEnvironment(browser);
      return testFn(browser);
    });
  });
}

// Export the setup for use in test files.
export { window, document };
