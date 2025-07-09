/**
 * LongTube extension popup script that provides user interface controls.
 * This script manages the popup's UI state, handles user interactions,
 * and communicates with content scripts to control Shorts blocking.
 */

// Wait for DOM to be ready before initializing
document.addEventListener('DOMContentLoaded', function() {
  // Use the browser compatibility layer
  const browserAPI = window.browserCompat;
  
  if (!browserAPI) {
    console.error('Browser compatibility layer not loaded');
    return;
  }

  // DOM element references for the popup UI
  const toggle = document.getElementById('toggle');
  const totalBlockedElement = document.getElementById('totalBlocked');
  const sessionBlockedElement = document.getElementById('sessionBlocked');
  const timeSavedElement = document.getElementById('timeSaved');
  const resetButton = document.getElementById('resetCount');
  const themeToggle = document.getElementById('themeToggle');

  // Tracks the total blocked count at the start of the session
  let sessionStartCount = 0;

  // Average time per Shorts video in seconds (15-30 seconds average)
  const AVERAGE_SHORTS_DURATION = 20;

  /**
   * Calculates and formats the time saved based on blocked Shorts count.
   * @param {number} count - Number of Shorts blocked.
   * @returns {string} Formatted time saved string.
   */
  function calculateTimeSaved(count) {
    const totalSeconds = count * AVERAGE_SHORTS_DURATION;

    if (totalSeconds < 60) {
      return `${totalSeconds} seconds`;
    } else if (totalSeconds < 3600) {
      const minutes = Math.floor(totalSeconds / 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      if (minutes === 0) {
        return `${hours} hour${hours !== 1 ? 's' : ''}`;
      }
      return `${hours}h ${minutes}m`;
    }
  }

  /**
   * Updates the popup UI to reflect the current extension state and blocked counts.
   * @param {boolean} enabled - Whether Shorts blocking is currently enabled.
   * @param {number} totalCount - The total number of Shorts blocked all-time.
   */
  function updateUI(enabled, totalCount) {
    toggle.classList.toggle('active', enabled);
    totalBlockedElement.textContent = totalCount || 0;
    sessionBlockedElement.textContent = Math.max(0, (totalCount || 0) - sessionStartCount);
    timeSavedElement.textContent = calculateTimeSaved(totalCount || 0);
  }

  /**
   * Loads and applies the saved theme preference.
   */
  function loadTheme() {
    browserAPI.storage.local.get(['theme']).then((result) => {
      const theme = result.theme || 'light';
      document.documentElement.setAttribute('data-theme', theme);
    }).catch((error) => {
      console.error('Failed to load theme:', error);
      document.documentElement.setAttribute('data-theme', 'light');
    });
  }

  /**
   * Toggles between light and dark theme.
   */
  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', newTheme);
    browserAPI.storage.local.set({ theme: newTheme }).catch((error) => {
      console.error('Failed to save theme:', error);
    });
  }

  // Initialize theme
  loadTheme();

  // Set up event listeners
  themeToggle.addEventListener('click', toggleTheme);

  toggle.addEventListener('click', async () => {
    const currentlyEnabled = toggle.classList.contains('active');
    const newEnabled = !currentlyEnabled;

    // Update UI immediately for responsiveness
    updateUI(newEnabled, parseInt(totalBlockedElement.textContent) || 0);

    try {
      // Persist the new state to storage
      await browserAPI.storage.local.set({ enabled: newEnabled });

      // Notify all YouTube tabs about the state change
      const tabs = await browserAPI.tabs.query({ url: '*://*.youtube.com/*' });
      
      for (const tab of tabs) {
        // Don't await to avoid blocking on tabs that might not respond
        browserAPI.tabs.sendMessage(tab.id, {
          action: 'toggleBlocking',
          enabled: newEnabled,
        }).catch(() => {
          // Ignore errors from tabs that can't receive messages
        });
      }
    } catch (error) {
      console.error('Error toggling state:', error);
      // Revert UI on error
      updateUI(currentlyEnabled, parseInt(totalBlockedElement.textContent) || 0);
    }
  });

  resetButton.addEventListener('click', async () => {
    try {
      await browserAPI.storage.local.set({
        totalBlockedCount: 0,
        sessionStartCount: 0,
      });
      
      sessionStartCount = 0;
      updateUI(toggle.classList.contains('active'), 0);
    } catch (error) {
      console.error('Error resetting stats:', error);
    }
  });

  // Load initial state
  browserAPI.storage.local
    .get(['enabled', 'totalBlockedCount', 'sessionStartCount'])
    .then((result) => {
      const enabled = result.enabled !== false; // Default to true if not set
      const totalCount = result.totalBlockedCount || 0;

      // Initialize session start count if this is the first time opening the popup
      if (result.sessionStartCount === undefined) {
        sessionStartCount = totalCount;
        browserAPI.storage.local.set({ sessionStartCount: totalCount }).catch((error) => {
          console.error('Failed to save session start count:', error);
        });
      } else {
        sessionStartCount = result.sessionStartCount;
      }

      updateUI(enabled, totalCount);
    })
    .catch((error) => {
      console.error('Failed to load initial state:', error);
      updateUI(true, 0);
    });

  // Listen for storage changes to update counts in real-time
  browserAPI.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.totalBlockedCount) {
      const newTotal = changes.totalBlockedCount.newValue || 0;
      totalBlockedElement.textContent = newTotal;
      sessionBlockedElement.textContent = Math.max(0, newTotal - sessionStartCount);
      timeSavedElement.textContent = calculateTimeSaved(newTotal);
    }
  });
});