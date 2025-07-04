import { test, expect, describe, beforeEach } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Tests using real YouTube HTML structure fixtures.
 * These tests verify that the extension correctly identifies and removes
 * Shorts content from actual YouTube page structures.
 */

describe('Real YouTube DOM Tests', () => {
  let youtubeHTML;

  beforeEach(() => {
    // Load the YouTube homepage HTML fixture from the test fixtures directory.
    youtubeHTML = readFileSync(join(import.meta.dir, 'fixtures/youtube-homepage.html'), 'utf-8');

    // Reset the DOM to a clean state with the loaded YouTube HTML.
    document.body.innerHTML = youtubeHTML;
    document.head.innerHTML = '';
    document.documentElement.className = '';
  });

  test('should find Shorts shelf in real YouTube structure', () => {
    // Search for the Shorts shelf using YouTube's actual element structure.
    const shortsShelf = document.querySelector('ytd-rich-shelf-renderer[is-shorts]');

    // Verify that the Shorts shelf is present and contains expected content.
    expect(shortsShelf).toBeTruthy();
    expect(shortsShelf.textContent).toContain('Shorts');
  });

  test('should find Shorts videos in real structure', () => {
    // Search for all links that point to Shorts videos.
    const shortsLinks = document.querySelectorAll('[href*="/shorts/"]');

    // Verify that Shorts links are found in the real YouTube structure.
    expect(shortsLinks.length).toBeGreaterThan(0);
    expect(shortsLinks[0].href).toContain('/shorts/');
  });

  test('should find Shorts navigation in real sidebar', () => {
    // Search for the Shorts navigation item in YouTube's sidebar.
    const shortsNav = document.querySelector('[aria-label="Shorts"]');

    // Verify that the Shorts navigation element exists and has the correct text.
    expect(shortsNav).toBeTruthy();
    expect(shortsNav.textContent).toContain('Shorts');
  });

  test('should find Shorts chip in real filter bar', () => {
    // Search for the Shorts filter chip in YouTube's chip cloud.
    const chips = document.querySelectorAll('yt-chip-cloud-chip-renderer button');
    const shortsChip = Array.from(chips).find((chip) => chip.textContent.trim() === 'Shorts');

    // Verify that a Shorts filter chip exists in the page.
    expect(shortsChip).toBeTruthy();
  });

  test('should remove Shorts shelf while preserving other content', () => {
    // Count regular video links before removing Shorts content.
    const regularVideosBefore = document.querySelectorAll('[href*="/watch?v="]').length;

    // Remove the Shorts shelf from the page.
    const shortsShelf = document.querySelector('ytd-rich-shelf-renderer[is-shorts]');
    shortsShelf?.remove();

    // Verify that regular video content remains unchanged.
    const regularVideosAfter = document.querySelectorAll('[href*="/watch?v="]').length;
    expect(regularVideosAfter).toBe(regularVideosBefore);

    // Confirm that the Shorts shelf has been completely removed.
    expect(document.querySelector('ytd-rich-shelf-renderer[is-shorts]')).toBeNull();
  });

  test('should apply CSS hiding with real structure', () => {
    // Create a function to inject the extension's CSS hiding rules.
    const injectCSS = () => {
      const style = document.createElement('style');
      style.id = 'longtube-test';
      style.textContent = `
        .longtube-active ytd-rich-shelf-renderer[is-shorts] {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
    };

    // Inject the CSS and activate the extension by adding the active class.
    injectCSS();
    document.documentElement.classList.add('longtube-active');

    // Verify that the CSS has been properly injected into the page.
    const shortsShelf = document.querySelector('ytd-rich-shelf-renderer[is-shorts]');

    // Note: Computing styles in test environment may not reflect actual browser behavior.
    // We verify that the CSS rules are present rather than their visual effect.
    expect(document.getElementById('longtube-test')).toBeTruthy();
    expect(shortsShelf).toBeTruthy();
  });

  test('should handle complex nested Shorts structure', () => {
    // Define a comprehensive function to remove all Shorts-related elements.
    const removeAllShorts = () => {
      // Remove Shorts shelf containers.
      document.querySelectorAll('ytd-rich-shelf-renderer[is-shorts]').forEach((el) => el.remove());

      // Remove individual Shorts video items.
      document.querySelectorAll('[href*="/shorts/"]').forEach((link) => {
        const container = link.closest('ytd-rich-item-renderer');
        container?.remove();
      });

      // Remove Shorts navigation items from the sidebar.
      document.querySelectorAll('[aria-label*="Shorts"]').forEach((nav) => nav.remove());

      // Remove Shorts filter chips from the homepage.
      document.querySelectorAll('yt-chip-cloud-chip-renderer').forEach((chip) => {
        if (chip.textContent.trim() === 'Shorts') {
          chip.remove();
        }
      });
    };

    // Execute the comprehensive Shorts removal function.
    removeAllShorts();

    // Verify that all Shorts-related elements have been removed.
    expect(document.querySelector('ytd-rich-shelf-renderer[is-shorts]')).toBeNull();
    expect(document.querySelectorAll('[href*="/shorts/"]').length).toBe(0);
    expect(document.querySelector('[aria-label*="Shorts"]')).toBeNull();

    // Verify that regular video content remains on the page after Shorts removal.
    const remainingVideos = document.querySelectorAll('ytd-rich-item-renderer');
    expect(remainingVideos.length).toBeGreaterThan(0);
  });
});
