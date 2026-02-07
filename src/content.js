'use strict';

const browserAPI = window.browserCompat || {
  storage: {
    local: chrome.storage.local,
    onChanged: chrome.storage.onChanged,
  },
  runtime: chrome.runtime,
};

const STYLE_ID = 'longtube-blocking-styles';
const ACTIVE_CLASS = 'longtube-active';
const REDIRECT_DELAY = 100;
const RICK_ROLL_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const ALTERNATE_URL = 'https://www.youtube.com/watch?v=9Deg7VrpHbM';
const OBSERVER_CONFIG = { childList: true, subtree: true };
const DEBUG = false;

const SELECTORS = {
  shortsContainers: 'ytd-rich-shelf-renderer[is-shorts], ytd-reel-shelf-renderer',
  shortsLinks: '[href*="/shorts/"]',
  shortsNavigation: '[title="Shorts"], [aria-label*="Shorts"]',
  shortsChips: 'yt-chip-cloud-chip-renderer, .ytChipShapeChip',
  videoContainers:
    'ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, ytd-rich-item-renderer, ytd-rich-grid-row',
  navigationContainers: 'ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer',
  chipContainer: 'yt-chip-cloud-chip-renderer',
};

const BLOCKING_CSS = `
  .${ACTIVE_CLASS} ytd-rich-shelf-renderer[is-shorts],
  .${ACTIVE_CLASS} ytd-reel-shelf-renderer,
  .${ACTIVE_CLASS} ytd-reel-item-renderer,
  .${ACTIVE_CLASS} [href*="/shorts/"],
  .${ACTIVE_CLASS} ytd-video-renderer:has([href*="/shorts/"]),
  .${ACTIVE_CLASS} ytd-compact-video-renderer:has([href*="/shorts/"]),
  .${ACTIVE_CLASS} ytd-grid-video-renderer:has([href*="/shorts/"]),
  .${ACTIVE_CLASS} ytd-rich-item-renderer:has([href*="/shorts/"]),
  .${ACTIVE_CLASS} ytd-rich-grid-row:has([href*="/shorts/"]),
  .${ACTIVE_CLASS} ytm-shorts-lockup-view-model,
  .${ACTIVE_CLASS} ytd-reel-video-renderer,
  .${ACTIVE_CLASS} [aria-label*="Shorts"],
  .${ACTIVE_CLASS} [title="Shorts"],
  .${ACTIVE_CLASS} ytd-guide-entry-renderer:has([title="Shorts"]),
  .${ACTIVE_CLASS} ytd-mini-guide-entry-renderer:has([title="Shorts"]),
  .${ACTIVE_CLASS} ytd-guide-entry-renderer[aria-label*="Shorts"],
  .${ACTIVE_CLASS} ytd-mini-guide-entry-renderer[aria-label*="Shorts"],
  .${ACTIVE_CLASS} .ytd-thumbnail[href*="/shorts/"],
  .${ACTIVE_CLASS} .badge-style-type-shorts,
  .${ACTIVE_CLASS} ytd-video-renderer:has(.badge-style-type-shorts),
  .${ACTIVE_CLASS} ytd-compact-video-renderer:has(.badge-style-type-shorts) {
    display: none !important;
  }
`;

const state = {
  isEnabled: true,
  pageBlockedCount: 0,
  removedElements: new WeakSet(),
  pendingBlockedCount: 0,
  isFlushingBlockedCount: false,
  blockedCountRetryTimer: null,
  reloadRequested: false,
};

const debugLog = (...args) => {
  if (DEBUG) {
    console.log('LongTube:', ...args);
  }
};

const logError = (message, error) => {
  console.error(`LongTube: ${message}`, error);
};

const isOnShortsPage = () => window.location.pathname.includes('/shorts');

const getRandomRedirectUrl = () =>
  Math.floor(Math.random() * 69) === 0 ? ALTERNATE_URL : RICK_ROLL_URL;

const injectBlockingCSS = () => {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = BLOCKING_CSS;

  const target = document.head || document.documentElement;
  target.appendChild(style);
};

const checkAndRedirect = () => {
  if (!state.isEnabled || !isOnShortsPage()) return;

  debugLog('Redirecting away from Shorts');
  window.location.href = getRandomRedirectUrl();
};

const removeElements = (selector, getContainer, additionalCheck = null) => {
  let count = 0;
  for (const element of document.querySelectorAll(selector)) {
    if (additionalCheck && !additionalCheck(element)) continue;

    const container = getContainer(element);
    if (!container || state.removedElements.has(container)) continue;

    state.removedElements.add(container);
    container.remove();
    count++;
  }

  return count;
};

const removeShortsFromDOM = () => {
  if (!state.isEnabled) return;

  let totalRemoved = 0;

  totalRemoved += removeElements(SELECTORS.shortsContainers, (el) => el);

  totalRemoved += removeElements(SELECTORS.shortsLinks, (link) =>
    link.closest(SELECTORS.videoContainers)
  );

  totalRemoved += removeElements(SELECTORS.shortsNavigation, (el) =>
    el.closest(SELECTORS.navigationContainers)
  );

  totalRemoved += removeElements(
    SELECTORS.shortsChips,
    (chip) => chip.closest(SELECTORS.chipContainer) || chip,
    (chip) => chip.textContent?.trim().toLowerCase() === 'shorts'
  );

  if (totalRemoved > 0) {
    updateBlockedCount(totalRemoved);
  }
};

const flushBlockedCount = async () => {
  if (state.isFlushingBlockedCount) return;

  if (state.blockedCountRetryTimer) {
    clearTimeout(state.blockedCountRetryTimer);
    state.blockedCountRetryTimer = null;
  }

  state.isFlushingBlockedCount = true;

  try {
    while (state.pendingBlockedCount > 0) {
      const countToPersist = state.pendingBlockedCount;
      state.pendingBlockedCount = 0;

      try {
        const result = await browserAPI.storage.local.get(['totalBlockedCount']);
        const currentTotal = Number(result.totalBlockedCount) || 0;
        const newTotal = currentTotal + countToPersist;
        await browserAPI.storage.local.set({ totalBlockedCount: newTotal });
        debugLog(
          `Blocked ${countToPersist} new items, total: ${newTotal}, page: ${state.pageBlockedCount}`
        );
      } catch (error) {
        state.pendingBlockedCount += countToPersist;
        throw error;
      }
    }
  } catch (error) {
    logError('Error updating blocked count:', error);

    if (!state.blockedCountRetryTimer) {
      state.blockedCountRetryTimer = setTimeout(() => {
        state.blockedCountRetryTimer = null;
        void flushBlockedCount();
      }, 1000);
    }
  } finally {
    state.isFlushingBlockedCount = false;
  }
};

const updateBlockedCount = (count) => {
  state.pageBlockedCount += count;
  state.pendingBlockedCount += count;
  void flushBlockedCount();
};

const updateBlockingState = (enabled) => {
  const { documentElement } = document;
  if (!documentElement) return;

  if (enabled) {
    documentElement.classList.add(ACTIVE_CLASS);
    removeShortsFromDOM();
  } else {
    documentElement.classList.remove(ACTIVE_CLASS);
  }
};

const requestReload = () => {
  if (state.reloadRequested) return;
  state.reloadRequested = true;
  window.location.reload();
};

const handleMessage = (request, _, sendResponse) => {
  switch (request.action) {
    case 'toggleBlocking':
      state.isEnabled = request.enabled;
      Promise.resolve(browserAPI.storage.local.set({ enabled: state.isEnabled }))
        .catch((error) => {
          logError('Failed to persist enabled state:', error);
        })
        .finally(() => {
          requestReload();
        });
      break;

    case 'getStatus':
      sendResponse({
        pageBlockedCount: state.pageBlockedCount,
        isEnabled: state.isEnabled,
      });
      break;
  }
};

const handleStorageChange = (changes, areaName) => {
  if (areaName !== 'local' || !changes.enabled) return;

  const nextEnabled = changes.enabled.newValue !== false;
  if (nextEnabled === state.isEnabled) return;

  state.isEnabled = nextEnabled;
  requestReload();
};

const createDOMObserver = () =>
  new MutationObserver(() => {
    if (state.isEnabled) removeShortsFromDOM();
  });

const createNavigationObserver = () => {
  let lastUrl = location.href;

  return new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      state.pageBlockedCount = 0;
      checkAndRedirect();

      if (state.isEnabled) {
        setTimeout(removeShortsFromDOM, REDIRECT_DELAY);
      }
    }
  });
};

const initialize = async () => {
  try {
    const result = await browserAPI.storage.local.get(['enabled']);
    state.isEnabled = result.enabled !== false;
    debugLog('Enabled =', state.isEnabled);

    injectBlockingCSS();
    updateBlockingState(state.isEnabled);
    checkAndRedirect();

    const domObserver = createDOMObserver();
    const navigationObserver = createNavigationObserver();

    if (document.body) {
      domObserver.observe(document.body, OBSERVER_CONFIG);
    } else {
      document.addEventListener(
        'DOMContentLoaded',
        () => {
          if (!document.body) return;
          domObserver.observe(document.body, OBSERVER_CONFIG);
        },
        { once: true }
      );
    }

    navigationObserver.observe(document, OBSERVER_CONFIG);

    if (document.readyState === 'loading') {
      document.addEventListener(
        'DOMContentLoaded',
        () => {
          if (state.isEnabled) removeShortsFromDOM();
        },
        { once: true }
      );
    }
  } catch (error) {
    logError('Initialization error:', error);
  }
};

browserAPI.runtime.onMessage.addListener(handleMessage);
browserAPI.storage.onChanged.addListener(handleStorageChange);
debugLog('Extension loaded');
initialize();
