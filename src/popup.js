document.addEventListener('DOMContentLoaded', () => {
  const browserAPI = window.browserCompat;
  if (!browserAPI) {
    console.error('Browser compatibility layer not loaded');
    return;
  }

  const toggle = document.getElementById('toggle');
  const totalBlockedElement = document.getElementById('totalBlocked');
  const sessionBlockedElement = document.getElementById('sessionBlocked');
  const timeSavedElement = document.getElementById('timeSaved');
  const resetButton = document.getElementById('resetCount');
  const themeToggle = document.getElementById('themeToggle');

  if (
    !toggle ||
    !totalBlockedElement ||
    !sessionBlockedElement ||
    !timeSavedElement ||
    !resetButton ||
    !themeToggle
  ) {
    console.error('Popup UI failed to initialize: required DOM elements are missing');
    return;
  }

  let sessionStartCount = 0;
  const AVERAGE_SHORTS_DURATION = 20;

  const calculateTimeSaved = (count) => {
    const totalSeconds = count * AVERAGE_SHORTS_DURATION;
    if (totalSeconds < 60) {
      return `${totalSeconds} seconds`;
    }

    if (totalSeconds < 3600) {
      const minutes = Math.floor(totalSeconds / 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (minutes === 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    return `${hours}h ${minutes}m`;
  };

  const updateUI = ({ enabled, totalCount }) => {
    toggle.classList.toggle('active', enabled);
    toggle.setAttribute('aria-checked', String(enabled));
    totalBlockedElement.textContent = String(totalCount || 0);
    sessionBlockedElement.textContent = String(Math.max(0, (totalCount || 0) - sessionStartCount));
    timeSavedElement.textContent = calculateTimeSaved(totalCount || 0);
  };

  const loadTheme = () => {
    browserAPI.storage.local
      .get(['theme'])
      .then((result) => {
        const theme = result.theme || 'light';
        document.documentElement.setAttribute('data-theme', theme);
      })
      .catch((error) => {
        console.error('Failed to load theme:', error);
        document.documentElement.setAttribute('data-theme', 'light');
      });
  };

  const toggleTheme = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', newTheme);
    browserAPI.storage.local.set({ theme: newTheme }).catch((error) => {
      console.error('Failed to save theme:', error);
    });
  };

  loadTheme();

  const getDisplayedTotalCount = () => Number.parseInt(totalBlockedElement.textContent, 10) || 0;
  const getDisplayedEnabled = () => toggle.classList.contains('active');

  themeToggle.addEventListener('click', toggleTheme);

  toggle.addEventListener('click', async () => {
    const currentEnabled = getDisplayedEnabled();
    const nextEnabled = !currentEnabled;

    updateUI({ enabled: nextEnabled, totalCount: getDisplayedTotalCount() });

    try {
      await browserAPI.storage.local.set({ enabled: nextEnabled });
    } catch (error) {
      console.error('Error toggling state:', error);
      updateUI({ enabled: currentEnabled, totalCount: getDisplayedTotalCount() });
      return;
    }

    if (!browserAPI.tabs?.query || !browserAPI.tabs?.sendMessage) {
      return;
    }

    try {
      const tabs = await browserAPI.tabs.query({});
      const deliveries = tabs
        .filter((tab) => typeof tab.id === 'number')
        .map((tab) =>
          browserAPI.tabs.sendMessage(tab.id, {
            action: 'toggleBlocking',
            enabled: nextEnabled,
          })
        );
      await Promise.allSettled(deliveries);
    } catch {
      // Storage change handling in content scripts is the primary path.
    }
  });

  resetButton.addEventListener('click', async () => {
    try {
      await browserAPI.storage.local.set({
        totalBlockedCount: 0,
        sessionStartCount: 0,
      });

      sessionStartCount = 0;
      updateUI({ enabled: getDisplayedEnabled(), totalCount: 0 });
    } catch (error) {
      console.error('Error resetting stats:', error);
    }
  });

  browserAPI.storage.local
    .get(['enabled', 'totalBlockedCount', 'sessionStartCount'])
    .then((result) => {
      const enabled = result.enabled !== false;
      const totalCount = result.totalBlockedCount || 0;

      if (result.sessionStartCount === undefined) {
        sessionStartCount = totalCount;
        browserAPI.storage.local.set({ sessionStartCount: totalCount }).catch((error) => {
          console.error('Failed to save session start count:', error);
        });
      } else {
        sessionStartCount = result.sessionStartCount;
      }

      updateUI({ enabled, totalCount });
    })
    .catch((error) => {
      console.error('Failed to load initial state:', error);
      updateUI({ enabled: true, totalCount: 0 });
    });

  browserAPI.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== 'local') return;

    const enabled = changes.enabled ? changes.enabled.newValue !== false : getDisplayedEnabled();
    const totalCount = changes.totalBlockedCount
      ? changes.totalBlockedCount.newValue || 0
      : getDisplayedTotalCount();
    updateUI({ enabled, totalCount });
  });
});
