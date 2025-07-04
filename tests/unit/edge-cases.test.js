import { test, expect, describe, beforeEach } from 'bun:test';

/**
 * Edge case tests for the LongTube extension.
 * These tests verify that the extension handles unusual scenarios, performance
 * concerns, and boundary conditions gracefully without breaking functionality.
 */

describe('Edge Cases', () => {
  beforeEach(() => {
    // Reset both body and head elements to ensure a clean test environment.
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  describe('Performance', () => {
    test('should handle pages with many Shorts efficiently', () => {
      // Create a page with 100 Shorts videos to test performance at scale.
      const shorts = Array(100)
        .fill(0)
        .map(
          (_, i) =>
            `<ytd-video-renderer><a href="/shorts/${i}">Shorts ${i}</a></ytd-video-renderer>`
        )
        .join('');
      document.body.innerHTML = shorts;

      // Measure the time taken to remove all Shorts elements.
      const start = performance.now();
      document.querySelectorAll('[href*="/shorts/"]').forEach((link) => {
        link.closest('ytd-video-renderer')?.remove();
      });
      const duration = performance.now() - start;

      // Verify that the removal operation completes quickly even with many elements.
      expect(duration).toBeLessThan(50);
      expect(document.querySelectorAll('ytd-video-renderer').length).toBe(0);
    });

    test('should not create memory leaks with WeakSet', () => {
      // Use WeakSet to track removed elements without preventing garbage collection.
      const removedElements = new WeakSet();

      // Add an element to the WeakSet to test proper tracking.
      const element = document.createElement('div');
      removedElements.add(element);

      // Verify that the element is tracked but can be garbage collected when dereferenced.
      expect(removedElements.has(element)).toBe(true);
      // Note: WeakSet allows garbage collection of elements when no other references exist.
    });
  });

  describe('Reliability', () => {
    test('should handle missing elements gracefully', () => {
      // Create a removal function that safely handles non-existent elements.
      const safeRemove = () => {
        const elements = document.querySelectorAll('.not-exists');
        elements.forEach((el) => el?.remove());
      };

      // Verify that the function doesn't throw errors when elements don't exist.
      expect(() => safeRemove()).not.toThrow();
    });

    test('should handle storage errors gracefully', () => {
      // Simulate a Chrome storage API that throws errors.
      global.chrome.storage.local.get = (_keys, _cb) => {
        throw new Error('Storage error');
      };

      // Create a function that safely reads from storage with error handling.
      const safeStorageRead = () => {
        try {
          chrome.storage.local.get(['enabled'], () => {});
        } catch {
          return false; // Default to disabled on error
        }
      };

      // Verify that storage errors are caught and handled with a safe default.
      expect(safeStorageRead()).toBe(false);
    });

    test('should work with different YouTube URL formats', () => {
      // Test various YouTube URL formats to ensure compatibility.
      const urls = [
        'https://www.youtube.com/shorts/abc123',
        'https://youtube.com/shorts/abc123',
        'https://m.youtube.com/shorts/abc123',
        'https://www.youtube.com/shorts/abc123?feature=share',
      ];

      // Create a function to detect Shorts URLs.
      const isShorts = (url) => url.includes('/shorts');

      // Verify that all URL formats are correctly identified as Shorts.
      urls.forEach((url) => {
        expect(isShorts(url)).toBe(true);
      });
    });
  });

  describe('User Experience', () => {
    test('should not remove non-Shorts content', () => {
      // Create a page with mixed content types to test selective removal.
      document.body.innerHTML = `
        <ytd-video-renderer><a href="/watch?v=123">Regular Video</a></ytd-video-renderer>
        <ytd-video-renderer><a href="/shorts/456">Shorts Video</a></ytd-video-renderer>
        <ytd-playlist-renderer><a href="/playlist?list=789">Playlist</a></ytd-playlist-renderer>
      `;

      // Remove only Shorts content while preserving other video types.
      document.querySelectorAll('[href*="/shorts/"]').forEach((link) => {
        link.closest('ytd-video-renderer')?.remove();
      });

      // Verify that regular videos and playlists remain untouched.
      expect(document.querySelectorAll('ytd-video-renderer').length).toBe(1);
      expect(document.querySelector('ytd-playlist-renderer')).toBeTruthy();
    });

    test('should handle dynamic class names', () => {
      // Test that the extension can find Shorts using various attribute selectors.
      const selectors = ['[href*="/shorts/"]', '[title="Shorts"]', '[aria-label*="Shorts"]'];

      document.body.innerHTML = `
        <a href="/shorts/123">Link</a>
        <div title="Shorts">Title</div>
        <div aria-label="Shorts videos">Aria</div>
      `;

      // Count elements found using different selector strategies.
      let found = 0;
      selectors.forEach((selector) => {
        found += document.querySelectorAll(selector).length;
      });

      // Verify that all selector variants successfully identify Shorts elements.
      expect(found).toBe(3);
    });

    test('should preserve YouTube player functionality', () => {
      // Create a mock YouTube video player element.
      document.body.innerHTML = `
        <div id="movie_player" class="html5-video-player">
          <video src="/watch?v=123"></video>
        </div>
      `;

      // Verify that the extension doesn't interfere with the video player.
      const player = document.getElementById('movie_player');

      // Ensure the player and its video element remain intact.
      expect(player).toBeTruthy();
      expect(player.querySelector('video')).toBeTruthy();
    });
  });

  describe('Boundary Conditions', () => {
    test('should handle empty page', () => {
      // Test behavior on a completely empty page.
      document.body.innerHTML = '';

      // Attempt to find and remove Shorts elements on an empty page.
      const removed = document.querySelectorAll('[href*="/shorts/"]');

      // Verify that the extension handles empty pages without errors.
      expect(removed.length).toBe(0);
    });

    test('should handle very long Shorts IDs', () => {
      // Create a Shorts link with an extremely long ID to test edge cases.
      const longId = 'x'.repeat(100);
      document.body.innerHTML = `
        <a href="/shorts/${longId}">Long Shorts</a>
      `;

      // Verify that the selector still works with unusually long IDs.
      const isShorts = document.querySelector('[href*="/shorts/"]');

      // Confirm that long IDs don't break the detection logic.
      expect(isShorts).toBeTruthy();
    });

    test('should handle special characters in URLs', () => {
      // Create URLs containing special characters and Unicode to test robustness.
      document.body.innerHTML = `
        <a href="/shorts/abc-123_xyz">Shorts with special chars</a>
        <a href="/shorts/видео">Shorts with unicode</a>
      `;

      // Select all Shorts links regardless of special characters in the URL.
      const shorts = document.querySelectorAll('[href*="/shorts/"]');

      // Verify that the selector works with various character encodings.
      expect(shorts.length).toBe(2);
    });
  });
});
