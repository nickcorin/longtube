/**
 * Cross-browser compatibility layer for browser extension APIs
 * Provides a unified Promise-based interface that works across all browsers and contexts
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
  } else if (ua.includes('Brave/') || (ua.includes('Chrome/') && navigator.brave)) {
    return { name: 'brave', engine: 'chromium' };
  } else if (ua.includes('Chrome/')) {
    return { name: 'chrome', engine: 'chromium' };
  }

  return { name: 'unknown', engine: 'unknown' };
};

const browserInfo = getBrowserInfo();

// Get the appropriate API object (chrome or browser)
const getBrowserAPI = () => {
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
};

const browserAPI = getBrowserAPI();

/**
 * Creates a Promise wrapper for callback-based Chrome APIs
 * Handles both APIs that already return Promises (Firefox) and callback-based APIs (Chrome)
 */
const promisifyChrome = (fn, context) => {
  return (...args) => {
    // Check if this is Firefox and the API already returns a Promise
    if (browserInfo.name === 'firefox') {
      const result = fn.apply(context, args);
      if (result && typeof result.then === 'function') {
        return result;
      }
    }

    // For Chrome/Brave, wrap in Promise
    return new Promise((resolve, reject) => {
      // Remove any callbacks from args
      const filteredArgs = args.filter((arg) => typeof arg !== 'function');

      // Add our callback as the last argument
      filteredArgs.push((result) => {
        // Check for errors
        if (browserAPI.runtime.lastError) {
          reject(new Error(browserAPI.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });

      // Call the original function with our callback
      fn.apply(context, filteredArgs);
    });
  };
};

// Create the unified browser compatibility API
const createBrowserCompat = () => {
  if (!browserAPI) {
    throw new Error('No browser extension API found');
  }

  // Storage API with Promise support
  const storage = {
    local: {
      get: promisifyChrome(browserAPI.storage.local.get, browserAPI.storage.local),
      set: promisifyChrome(browserAPI.storage.local.set, browserAPI.storage.local),
      remove: promisifyChrome(browserAPI.storage.local.remove, browserAPI.storage.local),
      clear: promisifyChrome(browserAPI.storage.local.clear, browserAPI.storage.local),
    },
    sync: browserAPI.storage.sync
      ? {
          get: promisifyChrome(browserAPI.storage.sync.get, browserAPI.storage.sync),
          set: promisifyChrome(browserAPI.storage.sync.set, browserAPI.storage.sync),
          remove: promisifyChrome(browserAPI.storage.sync.remove, browserAPI.storage.sync),
          clear: promisifyChrome(browserAPI.storage.sync.clear, browserAPI.storage.sync),
        }
      : null,
    onChanged: browserAPI.storage.onChanged,
  };

  // Runtime API
  const runtime = {
    sendMessage: promisifyChrome(browserAPI.runtime.sendMessage, browserAPI.runtime),
    onMessage: browserAPI.runtime.onMessage,
    getURL: (path) => browserAPI.runtime.getURL(path),
    getManifest: () => browserAPI.runtime.getManifest(),
    lastError: browserAPI.runtime.lastError,
  };

  // Tabs API
  const tabs = browserAPI.tabs
    ? {
        query: promisifyChrome(browserAPI.tabs.query, browserAPI.tabs),
        sendMessage: promisifyChrome(browserAPI.tabs.sendMessage, browserAPI.tabs),
        create: promisifyChrome(browserAPI.tabs.create, browserAPI.tabs),
        update: promisifyChrome(browserAPI.tabs.update, browserAPI.tabs),
        remove: promisifyChrome(browserAPI.tabs.remove, browserAPI.tabs),
      }
    : null;

  // Action/BrowserAction API (for extension icon/popup)
  const action = browserAPI.action || browserAPI.browserAction || null;

  // Feature detection utilities
  const features = {
    hasDeclarativeNetRequest: () => {
      return browserAPI && browserAPI.declarativeNetRequest !== undefined;
    },
    hasWebRequestBlocking: () => {
      return (
        browserAPI &&
        browserAPI.webRequest &&
        browserAPI.webRequest.onBeforeRequest &&
        browserInfo.name === 'firefox'
      );
    },
    hasServiceWorker: () => {
      return 'serviceWorker' in navigator && browserInfo.name !== 'firefox';
    },
  };

  return {
    browser: browserInfo,
    api: browserAPI,
    storage,
    runtime,
    tabs,
    action,
    features,
  };
};

// Create and export the compatibility layer
try {
  const browserCompat = createBrowserCompat();

  // Make available globally for all contexts
  if (typeof window !== 'undefined') {
    window.browserCompat = browserCompat;
  }

  // Also export for module systems if available
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = browserCompat;
  }
} catch (error) {
  console.error('Failed to initialize browser compatibility layer:', error);
}
