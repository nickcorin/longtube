'use strict';

// Use the browser compatibility layer from browser-compat.js.
// Fallback to chrome API if browserCompat is not available (Chrome doesn't need the compat layer).
const browserAPI = window.browserCompat || {
  storage: {
    local: chrome.storage.local,
    onChanged: chrome.storage.onChanged,
  },
  runtime: chrome.runtime,
};

/**
 * LongTube extension content script that blocks YouTube Shorts content.
 * This script runs on YouTube pages and removes Shorts videos, shelves, navigation items,
 * and redirects users away from Shorts pages.
 */

// Extension configuration constants.
const EXTENSION_NAME = 'LongTube';
const STYLE_ID = 'longtube-blocking-styles';
const ACTIVE_CLASS = 'longtube-active';
const REDIRECT_DELAY = 100; // Milliseconds to wait before removing elements after navigation.
const PROBABILITY_TOTAL = 69; // Total probability value for weighted random redirect.
const RICK_ROLL_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const ALTERNATE_URL = 'https://www.youtube.com/watch?v=9Deg7VrpHbM';

// CSS selectors for YouTube elements organized by type.
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

// CSS rules that hide Shorts elements when the extension is active.
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

/**
 * Manages the extension's state including enabled status and blocked element tracking.
 */
class ExtensionState {
  constructor() {
    this.isEnabled = true;
    this.pageBlockedCount = 0;
    this.removedElements = new WeakSet();
  }

  /**
   * Increments the count of blocked elements on the current page.
   * @param {number} count - The number of elements blocked.
   */
  incrementPageCount(count) {
    this.pageBlockedCount += count;
  }

  /**
   * Resets the page blocked count when navigating to a new page.
   */
  resetPageCount() {
    this.pageBlockedCount = 0;
  }

  /**
   * Checks if an element has already been removed to prevent duplicate processing.
   * @param {Element} element - The DOM element to check.
   * @returns {boolean} True if the element was already processed.
   */
  hasRemoved(element) {
    return this.removedElements.has(element);
  }

  /**
   * Marks an element as removed to track processed elements.
   * @param {Element} element - The DOM element to mark as removed.
   */
  markAsRemoved(element) {
    this.removedElements.add(element);
  }
}

const state = new ExtensionState();

/**
 * Logs messages with the extension name prefix for debugging.
 * @param {string} message - The message to log.
 * @param {...any} args - Additional arguments to pass to console.log.
 */
const log = (message, ...args) => {
  console.log(`${EXTENSION_NAME}: ${message}`, ...args);
};

/**
 * Determines if the current page is a YouTube Shorts page.
 * @returns {boolean} True if the current URL is a Shorts page.
 */
const isOnShortsPage = () => {
  const { pathname } = window.location;
  return pathname.includes('/shorts') || pathname === '/shorts';
};

/**
 * Returns a random redirect URL with weighted probability.
 * Returns the Rick Roll URL 68/69 times and the alternate URL 1/69 times.
 * @returns {string} The URL to redirect to.
 */
const getRandomRedirectUrl = () => {
  const randomNum = Math.floor(Math.random() * PROBABILITY_TOTAL);
  return randomNum === 0 ? ALTERNATE_URL : RICK_ROLL_URL;
};

/**
 * Injects CSS rules to hide Shorts elements when the extension is enabled.
 * The CSS is only injected once and targets all Shorts-related elements.
 */
const injectBlockingCSS = () => {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = BLOCKING_CSS;

  const target = document.head || document.documentElement;
  target.appendChild(style);
};

/**
 * Redirects away from Shorts pages to a random video when blocking is enabled.
 * Only redirects if the extension is enabled and the current page is a Shorts page.
 */
const checkAndRedirect = () => {
  if (!state.isEnabled || !isOnShortsPage()) return;

  log('Redirecting away from Shorts');
  window.location.href = getRandomRedirectUrl();
};

/**
 * Removes elements matching a selector from the DOM.
 * @param {string} selector - CSS selector for elements to remove.
 * @param {function(Element): Element} getContainer - Function to get the container element to remove.
 * @param {function(Element): boolean} [additionalCheck=null] - Optional function to filter elements.
 * @returns {number} The count of removed elements.
 */
const removeElements = (selector, getContainer, additionalCheck = null) => {
  let count = 0;
  const elements = document.querySelectorAll(selector);

  elements.forEach((element) => {
    if (additionalCheck && !additionalCheck(element)) return;

    const container = getContainer(element);
    if (container && !state.hasRemoved(container)) {
      state.markAsRemoved(container);
      container.remove();
      count++;
    }
  });

  return count;
};

/**
 * Removes all Shorts-related elements from the current page.
 * This includes Shorts shelves, videos, navigation items, and filter chips.
 */
const removeShortsFromDOM = () => {
  if (!state.isEnabled) return;

  let totalRemoved = 0;

  // Remove dedicated Shorts shelf containers.
  totalRemoved += removeElements(SELECTORS.shortsContainers, (el) => el);

  // Remove individual video containers that link to Shorts.
  totalRemoved += removeElements(SELECTORS.shortsLinks, (link) =>
    link.closest(SELECTORS.videoContainers)
  );

  // Remove Shorts items from the navigation sidebar.
  totalRemoved += removeElements(SELECTORS.shortsNavigation, (el) =>
    el.closest(SELECTORS.navigationContainers)
  );

  // Remove Shorts filter chips from the homepage.
  totalRemoved += removeElements(
    SELECTORS.shortsChips,
    (chip) => chip.closest(SELECTORS.chipContainer) || chip,
    (chip) => chip.textContent?.trim().toLowerCase() === 'shorts'
  );

  if (totalRemoved > 0) {
    updateBlockedCount(totalRemoved);
  }
};

/**
 * Updates the total blocked count in storage and the page count in state.
 * @param {number} count - The number of newly blocked elements.
 */
const updateBlockedCount = async (count) => {
  state.incrementPageCount(count);

  try {
    const result = await browserAPI.storage.local.get(['totalBlockedCount']);
    const newTotal = (result.totalBlockedCount || 0) + count;
    await browserAPI.storage.local.set({ totalBlockedCount: newTotal });
    log(`Blocked ${count} new items, total: ${newTotal}, page: ${state.pageBlockedCount}`);
  } catch (error) {
    log('Error updating blocked count:', error);
  }
};

/**
 * Updates the page's blocking state by toggling CSS classes and removing elements.
 * @param {boolean} enabled - Whether blocking should be enabled.
 */
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

/**
 * Handles messages from the popup to toggle blocking or get status.
 * @param {Object} request - The message request object.
 * @param {MessageSender} _ - The sender information (unused).
 * @param {function} sendResponse - Function to send a response back.
 */
const handleMessage = (request, _, sendResponse) => {
  switch (request.action) {
    case 'toggleBlocking':
      state.isEnabled = request.enabled;
      browserAPI.storage.local.set({ enabled: state.isEnabled }).then(() => {
        window.location.reload();
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

/**
 * Creates an observer to watch for DOM changes and remove new Shorts elements.
 * @returns {MutationObserver} The configured mutation observer.
 */
const createDOMObserver = () => {
  return new MutationObserver(() => {
    if (state.isEnabled) {
      removeShortsFromDOM();
    }
  });
};

/**
 * Creates an observer to detect navigation changes and handle page transitions.
 * YouTube uses client-side navigation, so URL changes need to be detected manually.
 * @returns {MutationObserver} The configured mutation observer.
 */
const createNavigationObserver = () => {
  let lastUrl = location.href;

  return new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      state.resetPageCount();
      checkAndRedirect();

      if (state.isEnabled) {
        setTimeout(removeShortsFromDOM, REDIRECT_DELAY);
      }
    }
  });
};

/**
 * Initializes the extension by loading settings, injecting CSS, and setting up observers.
 * This is the main entry point that sets up all extension functionality.
 */
const initialize = async () => {
  try {
    // Load the enabled state from storage, defaulting to true.
    const result = await browserAPI.storage.local.get(['enabled']);
    state.isEnabled = result.enabled !== false;
    log('Enabled =', state.isEnabled);

    // Inject the blocking CSS rules into the page.
    injectBlockingCSS();

    // Apply the initial blocking state.
    updateBlockingState(state.isEnabled);

    // Check if we need to redirect away from a Shorts page.
    checkAndRedirect();

    // Create observers for DOM and navigation changes.
    const domObserver = createDOMObserver();
    const navigationObserver = createNavigationObserver();

    // Start observing DOM changes to catch dynamically loaded content.
    if (document.body) {
      domObserver.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        if (document.body) {
          domObserver.observe(document.body, { childList: true, subtree: true });
        }
      });
    }

    // Start observing for client-side navigation changes.
    navigationObserver.observe(document, { subtree: true, childList: true });

    // Apply blocking state when DOM is ready if not already loaded.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        updateBlockingState(state.isEnabled);
      });
    } else {
      updateBlockingState(state.isEnabled);
    }
  } catch (error) {
    log('Initialization error:', error);
  }
};

// Set up the message listener for communication with the popup.
browserAPI.runtime.onMessage.addListener(handleMessage);

// Start the extension when the content script loads.
log('Extension loaded');
initialize();
