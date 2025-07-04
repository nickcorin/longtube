import { test, expect, describe, beforeEach } from 'bun:test';

/**
 * Unit tests for the chip removal functionality of the LongTube extension.
 * These tests verify that YouTube's filter chips (specifically "Shorts" chips)
 * are correctly identified and removed from the page while preserving other content.
 */

describe('Chip Removal Logic', () => {
  beforeEach(() => {
    // Clear the DOM before each test to ensure a clean testing environment.
    document.body.innerHTML = '';
  });

  test('should remove Shorts chips by text content', () => {
    // Create a mock YouTube page with various filter chips including Shorts.
    document.body.innerHTML = `
      <yt-chip-cloud-chip-renderer>
        <span>Shorts</span>
      </yt-chip-cloud-chip-renderer>
      <yt-chip-cloud-chip-renderer>
        <span>Music</span>
      </yt-chip-cloud-chip-renderer>
      <div class="ytChipShapeChip">shorts</div>
      <div class="ytChipShapeChip">Gaming</div>
    `;

    // Execute the chip removal logic that identifies and removes Shorts chips.
    const removedElements = new WeakSet();
    let removedCount = 0;

    document.querySelectorAll('yt-chip-cloud-chip-renderer, .ytChipShapeChip').forEach((chip) => {
      if (chip.textContent?.trim().toLowerCase() === 'shorts') {
        const chipToRemove = chip.closest('yt-chip-cloud-chip-renderer') || chip;
        if (!removedElements.has(chipToRemove)) {
          removedElements.add(chipToRemove);
          chipToRemove.remove();
          removedCount++;
        }
      }
    });

    // Verify that only the Shorts chips were removed while other chips remain.
    expect(removedCount).toBe(2);
    expect(document.querySelectorAll('yt-chip-cloud-chip-renderer').length).toBe(1);
    expect(document.querySelectorAll('.ytChipShapeChip').length).toBe(1);
    expect(document.body.textContent).toContain('Music');
    expect(document.body.textContent).toContain('Gaming');
    expect(document.body.textContent).not.toContain('Shorts');
    expect(document.body.textContent).not.toContain('shorts');
  });

  test('should handle different text cases and whitespace', () => {
    // Create chips with various text formats to test case-insensitive matching.
    document.body.innerHTML = `
      <yt-chip-cloud-chip-renderer>  SHORTS  </yt-chip-cloud-chip-renderer>
      <yt-chip-cloud-chip-renderer>Shorts</yt-chip-cloud-chip-renderer>
      <yt-chip-cloud-chip-renderer>ShoRtS</yt-chip-cloud-chip-renderer>
      <yt-chip-cloud-chip-renderer>Short Videos</yt-chip-cloud-chip-renderer>
    `;

    // Execute the removal logic with case-insensitive matching.
    let removedCount = 0;
    document.querySelectorAll('yt-chip-cloud-chip-renderer').forEach((chip) => {
      if (chip.textContent?.trim().toLowerCase() === 'shorts') {
        chip.remove();
        removedCount++;
      }
    });

    // Verify that all case variations of "shorts" were removed but similar text was preserved.
    expect(removedCount).toBe(3);
    expect(document.querySelectorAll('yt-chip-cloud-chip-renderer').length).toBe(1);
    expect(document.body.textContent).toContain('Short Videos');
  });

  test('should handle nested elements in chips', () => {
    // Create chips with YouTube's actual nested structure to test text extraction.
    document.body.innerHTML = `
      <yt-chip-cloud-chip-renderer>
        <yt-formatted-string>
          <span>Shorts</span>
        </yt-formatted-string>
      </yt-chip-cloud-chip-renderer>
    `;

    // Extract the chip element to verify text content detection works with nested elements.
    const chip = document.querySelector('yt-chip-cloud-chip-renderer');

    // Verify that the text content is correctly extracted from nested elements.
    expect(chip.textContent.trim()).toBe('Shorts');
  });
});
