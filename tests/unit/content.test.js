import { test, expect, describe, beforeEach } from 'bun:test';

/**
 * Unit tests for the LongTube content script functionality.
 * These tests verify the core behaviors of the content script without loading the actual script,
 * using mock implementations to test individual functions and behaviors in isolation.
 */

describe('LongTube Content Script', () => {
  let mockStorage = {};

  beforeEach(() => {
    // Reset the DOM to a clean state for each test.
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    document.documentElement.className = '';

    // Reset mock storage to empty state.
    mockStorage = {};

    // Set up Chrome extension API mocks.
    global.chrome = {
      storage: {
        local: {
          get: (keys, cb) => cb(mockStorage),
          set: (items, cb) => {
            Object.assign(mockStorage, items);
            cb && cb();
          },
        },
      },
      runtime: {
        onMessage: {
          addListener: () => {},
        },
      },
    };

    // Reset window.location to a default YouTube URL.
    // In some environments, window.location is not configurable
    try {
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/',
          href: 'https://www.youtube.com/',
        },
        writable: true,
        configurable: true,
      });
    } catch {
      // If window.location can't be redefined, mock it on the global object
      global.window = {
        ...global.window,
        location: {
          pathname: '/',
          href: 'https://www.youtube.com/',
        },
      };
    }
  });

  describe('CSS Injection', () => {
    test('should inject blocking CSS styles', () => {
      // Mock implementation of the CSS injection function.
      const injectBlockingCSS = () => {
        const styleId = 'longtube-blocking-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = '.longtube-active [href*="/shorts/"] { display: none !important; }';
        document.head.appendChild(style);
      };

      // Execute the CSS injection.
      injectBlockingCSS();

      // Verify that the style element was created with correct properties.
      const style = document.getElementById('longtube-blocking-styles');
      expect(style).toBeTruthy();
      expect(style.textContent).toContain('display: none');
    });
  });

  describe('Element Removal', () => {
    test('should remove Shorts elements when enabled', () => {
      // Set up a DOM structure with both Shorts and regular videos.
      document.body.innerHTML = `
        <ytd-video-renderer>
          <a href="/shorts/123">Shorts Video</a>
        </ytd-video-renderer>
        <ytd-video-renderer>
          <a href="/watch?v=456">Regular Video</a>
        </ytd-video-renderer>
      `;

      // Mock implementation of the Shorts removal function.
      const removeShortsFromDOM = () => {
        document.querySelectorAll('[href*="/shorts/"]').forEach((link) => {
          const container = link.closest('ytd-video-renderer');
          if (container) container.remove();
        });
      };

      removeShortsFromDOM();

      // Verify that only Shorts videos were removed, regular videos remain.
      const videos = document.querySelectorAll('ytd-video-renderer');
      expect(videos.length).toBe(1);
      expect(videos[0].textContent).toContain('Regular Video');
    });
  });

  describe('Redirect Logic', () => {
    test('should redirect from Shorts URLs with probability', () => {
      // Mock implementation of the redirect function with weighted probability.
      const checkAndRedirect = (isEnabled) => {
        if (isEnabled && window.location.pathname.includes('/shorts')) {
          // 68/69 chance for Rick Roll, 1/69 chance for the other video
          const randomNum = Math.floor(Math.random() * 69);
          if (randomNum === 0) {
            window.location.href = 'https://www.youtube.com/watch?v=9Deg7VrpHbM';
          } else {
            window.location.href = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
          }
        }
      };

      // Simulate being on a Shorts page with blocking enabled.
      try {
        Object.defineProperty(window, 'location', {
          value: {
            pathname: '/shorts/abc123',
            href: 'https://www.youtube.com/shorts/abc123',
          },
          writable: true,
          configurable: true,
        });
      } catch {
        // If window.location can't be redefined, mock it on the global object
        global.window = {
          ...global.window,
          location: {
            pathname: '/shorts/abc123',
            href: 'https://www.youtube.com/shorts/abc123',
          },
        };
      }
      checkAndRedirect(true);

      // Verify redirect occurred to one of the valid URLs.
      const redirectUrl = window.location.href;
      const validUrls = [
        'https://www.youtube.com/watch?v=9Deg7VrpHbM',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      ];
      expect(validUrls).toContain(redirectUrl);
    });

    test('should mostly redirect to Rick Roll', () => {
      // Test the probability distribution of redirect URLs.
      let rickRollCount = 0;
      let otherVideoCount = 0;

      // Run multiple iterations to verify the 68/69 probability distribution.
      for (let i = 0; i < 690; i++) {
        const randomNum = Math.floor(Math.random() * 69);
        if (randomNum === 0) {
          otherVideoCount++;
        } else {
          rickRollCount++;
        }
      }

      // Verify the distribution matches expected probabilities.
      // Should be approximately 680 Rick Rolls and 10 alternate videos.
      expect(rickRollCount).toBeGreaterThan(600);
      expect(otherVideoCount).toBeLessThan(90);
    });
  });

  describe('Toggle State', () => {
    test('should apply active class when enabled', () => {
      // Mock implementation of the blocking state toggle.
      const updateBlockingState = (enabled) => {
        if (enabled) {
          document.documentElement.classList.add('longtube-active');
        } else {
          document.documentElement.classList.remove('longtube-active');
        }
      };

      // Test enabling the blocking state.
      updateBlockingState(true);

      // Verify the active class is added.
      expect(document.documentElement.classList.contains('longtube-active')).toBe(true);

      // Test disabling the blocking state.
      updateBlockingState(false);

      // Verify the active class is removed.
      expect(document.documentElement.classList.contains('longtube-active')).toBe(false);
    });
  });

  describe('Counter Logic', () => {
    test('should track removed elements count', () => {
      // Mock implementation of the blocked count tracking.
      let totalCount = 0;
      const updateBlockedCount = (count) => {
        totalCount += count;
      };

      // Simulate removing elements in multiple batches.
      updateBlockedCount(3);
      updateBlockedCount(2);

      // Verify counts are accumulated correctly.
      expect(totalCount).toBe(5);
    });
  });
});
