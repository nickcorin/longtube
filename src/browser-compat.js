(function () {
  const userAgent = navigator.userAgent;
  const browserInfo = (() => {
    if (userAgent.includes('Firefox/')) return { name: 'firefox', engine: 'gecko' };
    if (userAgent.includes('Edg/')) return { name: 'edge', engine: 'chromium' };
    if (userAgent.includes('OPR/') || userAgent.includes('Opera/')) {
      return { name: 'opera', engine: 'chromium' };
    }
    if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) {
      return { name: 'safari', engine: 'webkit' };
    }
    if (userAgent.includes('Brave/') || (userAgent.includes('Chrome/') && navigator.brave)) {
      return { name: 'brave', engine: 'chromium' };
    }
    if (userAgent.includes('Chrome/')) return { name: 'chrome', engine: 'chromium' };
    return { name: 'unknown', engine: 'unknown' };
  })();

  const browserAPI =
    (typeof browser !== 'undefined' && browser.runtime && browser) ||
    (typeof chrome !== 'undefined' && chrome.runtime && chrome) ||
    null;

  const noOpListeners = {
    addListener: () => {},
    removeListener: () => {},
  };

  const promisify = (fn, context) => {
    if (typeof fn !== 'function') return () => Promise.resolve();

    return (...args) => {
      if (browserInfo.name === 'firefox') {
        const result = fn.apply(context, args);
        if (result && typeof result.then === 'function') {
          return result;
        }
      }

      return new Promise((resolve, reject) => {
        const params = args.filter((arg) => typeof arg !== 'function');
        params.push((result) => {
          const message = browserAPI?.runtime?.lastError?.message;
          if (message) {
            reject(new Error(message));
            return;
          }
          resolve(result);
        });
        fn.apply(context, params);
      });
    };
  };

  try {
    if (!browserAPI?.storage?.local) {
      throw new Error('Storage local API is unavailable');
    }

    const optional = (obj, method) => promisify(obj?.[method], obj);

    const compat = {
      browser: browserInfo,
      api: browserAPI,
      storage: {
        local: {
          get: optional(browserAPI.storage.local, 'get'),
          set: optional(browserAPI.storage.local, 'set'),
          remove: optional(browserAPI.storage.local, 'remove'),
          clear: optional(browserAPI.storage.local, 'clear'),
        },
        sync: browserAPI.storage.sync
          ? {
              get: optional(browserAPI.storage.sync, 'get'),
              set: optional(browserAPI.storage.sync, 'set'),
              remove: optional(browserAPI.storage.sync, 'remove'),
              clear: optional(browserAPI.storage.sync, 'clear'),
            }
          : null,
        onChanged: browserAPI.storage.onChanged || noOpListeners,
      },
      runtime: {
        sendMessage: optional(browserAPI.runtime, 'sendMessage'),
        onMessage: browserAPI.runtime?.onMessage || noOpListeners,
        getURL: (path) => browserAPI.runtime?.getURL?.(path),
        getManifest: () => browserAPI.runtime?.getManifest?.() || null,
        lastError: browserAPI.runtime?.lastError,
      },
      tabs: browserAPI.tabs
        ? {
            query: optional(browserAPI.tabs, 'query'),
            sendMessage: optional(browserAPI.tabs, 'sendMessage'),
            create: optional(browserAPI.tabs, 'create'),
            update: optional(browserAPI.tabs, 'update'),
            remove: optional(browserAPI.tabs, 'remove'),
          }
        : null,
      action: browserAPI.action || browserAPI.browserAction || null,
      features: {
        hasDeclarativeNetRequest: () => browserAPI.declarativeNetRequest !== undefined,
        hasWebRequestBlocking: () =>
          !!browserAPI.webRequest?.onBeforeRequest && browserInfo.name === 'firefox',
        hasServiceWorker: () => 'serviceWorker' in navigator && browserInfo.name !== 'firefox',
      },
    };

    if (typeof window !== 'undefined') {
      window.browserCompat = compat;
    }
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = compat;
    }
  } catch (error) {
    console.error('Failed to initialize browser compatibility layer:', error);
  }
})();
