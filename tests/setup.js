import { test } from 'bun:test';
import { Window } from 'happy-dom';

const window = new Window();
const document = window.document;

global.window = window;
global.document = document;
global.HTMLElement = window.HTMLElement;

if (!window.MutationObserver) {
  class MutationObserverFallback {
    constructor(callback) {
      this.callback = callback;
      this.target = null;
      this.listener = null;
    }

    observe(target) {
      this.target = target;
      this.listener = () => {
        setTimeout(() => this.callback([{ type: 'childList', target }], this), 0);
      };
      target?.addEventListener?.('DOMNodeInserted', this.listener);
    }

    disconnect() {
      this.target?.removeEventListener?.('DOMNodeInserted', this.listener);
    }
  }

  global.MutationObserver = MutationObserverFallback;
  window.MutationObserver = MutationObserverFallback;
  Window.prototype.MutationObserver = MutationObserverFallback;
}

class StorageMock {
  constructor() {
    this.data = {};
    this.listeners = [];
  }

  get(keys, callback) {
    const values = {};
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      if (this.data[key] !== undefined) values[key] = this.data[key];
    }

    if (callback) {
      setTimeout(() => callback(values), 0);
      return undefined;
    }
    return Promise.resolve(values);
  }

  set(items, callback) {
    const previous = { ...this.data };
    Object.assign(this.data, items);

    const changes = {};
    for (const key of Object.keys(items)) {
      changes[key] = { oldValue: previous[key], newValue: this.data[key] };
    }
    for (const listener of this.listeners) {
      setTimeout(() => listener(changes, 'local'), 0);
    }

    if (callback) {
      setTimeout(callback, 0);
      return undefined;
    }
    return Promise.resolve();
  }

  clear(callback) {
    this.data = {};
    if (callback) {
      setTimeout(callback, 0);
      return undefined;
    }
    return Promise.resolve();
  }
}

const storage = new StorageMock();
const storageOnChanged = {
  addListener: (listener) => storage.listeners.push(listener),
  removeListener: (listener) => {
    const index = storage.listeners.indexOf(listener);
    if (index >= 0) storage.listeners.splice(index, 1);
  },
};

global.chrome = {
  storage: {
    local: storage,
    onChanged: storageOnChanged,
  },
  runtime: {
    onMessage: {
      addListener: () => {},
      removeListener: () => {},
    },
    lastError: null,
  },
  tabs: {
    query: (_queryInfo, callback) => {
      const tabs = [{ id: 1, url: 'https://www.youtube.com/' }];
      if (callback) {
        setTimeout(() => callback(tabs), 0);
        return undefined;
      }
      return Promise.resolve(tabs);
    },
    sendMessage: (_tabId, _message, callback) => {
      if (callback) {
        setTimeout(callback, 0);
        return undefined;
      }
      return Promise.resolve();
    },
  },
};

global.browser = {
  storage: {
    local: {
      get: (keys) => storage.get(keys),
      set: (items) => storage.set(items),
      clear: () => storage.clear(),
    },
    onChanged: storageOnChanged,
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

export function setupBrowserEnvironment(browserType = 'chrome') {
  storage.data = {};

  if (browserType === 'firefox') {
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
    delete window.browserCompat;
  }

  global.browserCompat = window.browserCompat;
}

export function testWithBrowsers(testName, testFn) {
  for (const browserType of ['chrome', 'firefox']) {
    test(`${testName} (${browserType})`, () => {
      setupBrowserEnvironment(browserType);
      return testFn(browserType);
    });
  }
}

export { window, document };
