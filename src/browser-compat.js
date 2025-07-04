/**
 * Cross-browser compatibility layer for browser extension APIs
 * Handles differences between Chrome, Firefox, Safari, Edge, and Opera
 */

// Detect the browser environment
const getBrowserInfo = () => {
  const ua = navigator.userAgent;

  if (ua.includes('Firefox/')) {
    return { name: 'firefox', engine: 'gecko' };
  } else if (ua.includes('Edg/')) {
    return { name: 'edge', engine: 'chromium' };
  } else if (ua.includes('OPR/') || ua.includes('Opera/')) {
    return { name: 'opera', engine: 'chromium' };
  } else if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    return { name: 'safari', engine: 'webkit' };
  } else if (ua.includes('Chrome/')) {
    return { name: 'chrome', engine: 'chromium' };
  }

  return { name: 'unknown', engine: 'unknown' };
};

const browserInfo = getBrowserInfo();

// Use the appropriate API namespace
const browserAPI = (() => {
  // Firefox uses 'browser' namespace
  if (typeof browser !== 'undefined' && browser.runtime) {
    return browser;
  }
  // Chrome and Chromium-based browsers use 'chrome' namespace
  else if (typeof chrome !== 'undefined' && chrome.runtime) {
    return chrome;
  }
  // Fallback
  return null;
})();

// Polyfill for Promise-based APIs (Firefox style) on Chrome
const promisifyAPI = (api, method) => {
  return (...args) => {
    return new Promise((resolve, reject) => {
      const callback = (result) => {
        if (browserAPI.runtime.lastError) {
          reject(new Error(browserAPI.runtime.lastError.message));
        } else {
          resolve(result);
        }
      };

      // Check if the method already returns a Promise (Firefox)
      const result = api[method](...args, callback);
      if (result && typeof result.then === 'function') {
        return result;
      }
    });
  };
};

// Storage API wrapper with Promise support
const storage = {
  local: {
    get: (keys) => {
      if (browserInfo.name === 'firefox') {
        return browserAPI.storage.local.get(keys);
      }
      return promisifyAPI(browserAPI.storage.local, 'get')(keys);
    },

    set: (items) => {
      if (browserInfo.name === 'firefox') {
        return browserAPI.storage.local.set(items);
      }
      return promisifyAPI(browserAPI.storage.local, 'set')(items);
    },

    remove: (keys) => {
      if (browserInfo.name === 'firefox') {
        return browserAPI.storage.local.remove(keys);
      }
      return promisifyAPI(browserAPI.storage.local, 'remove')(keys);
    },

    clear: () => {
      if (browserInfo.name === 'firefox') {
        return browserAPI.storage.local.clear();
      }
      return promisifyAPI(browserAPI.storage.local, 'clear')();
    },
  },

  onChanged: {
    addListener: (callback) => {
      browserAPI.storage.onChanged.addListener(callback);
    },

    removeListener: (callback) => {
      browserAPI.storage.onChanged.removeListener(callback);
    },
  },
};

// Runtime API wrapper
const runtime = {
  sendMessage: (message) => {
    if (browserInfo.name === 'firefox') {
      return browserAPI.runtime.sendMessage(message);
    }
    return promisifyAPI(browserAPI.runtime, 'sendMessage')(message);
  },

  onMessage: {
    addListener: (callback) => {
      // Convert callback to handle both Chrome and Firefox styles
      const wrappedCallback = (message, sender, sendResponse) => {
        const result = callback(message, sender, sendResponse);

        // Firefox expects true to be returned for async responses
        if (result instanceof Promise) {
          result.then(sendResponse);
          return true; // Keep message channel open
        }

        return result;
      };

      browserAPI.runtime.onMessage.addListener(wrappedCallback);
    },

    removeListener: (callback) => {
      browserAPI.runtime.onMessage.removeListener(callback);
    },
  },

  getURL: (path) => browserAPI.runtime.getURL(path),

  getManifest: () => browserAPI.runtime.getManifest(),
};

// Tabs API wrapper (for potential future use)
const tabs = {
  query: (queryInfo) => {
    if (browserInfo.name === 'firefox') {
      return browserAPI.tabs.query(queryInfo);
    }
    return promisifyAPI(browserAPI.tabs, 'query')(queryInfo);
  },

  sendMessage: (tabId, message) => {
    if (browserInfo.name === 'firefox') {
      return browserAPI.tabs.sendMessage(tabId, message);
    }
    return promisifyAPI(browserAPI.tabs, 'sendMessage')(tabId, message);
  },
};

// Action API wrapper (handles browser action / page action differences)
const action = (() => {
  // Safari might still use browserAction
  if (browserAPI.browserAction) {
    return browserAPI.browserAction;
  }
  // Modern browsers use action
  return browserAPI.action;
})();

// Feature detection utilities
const features = {
  // Check if declarativeNetRequest is available (for future blocking features)
  hasDeclarativeNetRequest: () => {
    return browserAPI && browserAPI.declarativeNetRequest !== undefined;
  },

  // Check if webRequest blocking is available (Firefox-specific)
  hasWebRequestBlocking: () => {
    return (
      browserAPI &&
      browserAPI.webRequest &&
      browserAPI.webRequest.onBeforeRequest &&
      browserInfo.name === 'firefox'
    );
  },

  // Check if the browser supports service workers (not Firefox)
  hasServiceWorker: () => {
    return 'serviceWorker' in navigator && browserInfo.name !== 'firefox';
  },
};

// Export the compatibility layer
const compat = {
  browser: browserInfo,
  api: browserAPI,
  storage,
  runtime,
  tabs,
  action,
  features,
};

// For ES6 modules
export default compat;

// For backward compatibility with scripts
if (typeof window !== 'undefined') {
  window.browserCompat = compat;
}
