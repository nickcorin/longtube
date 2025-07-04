import { test, expect, describe } from 'bun:test';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Basic end-to-end tests for the LongTube extension structure.
 * These tests verify that all extension files are properly structured
 * and contain the required elements without needing a real browser.
 */

describe('Extension Structure Tests', () => {
  test('manifest.json should be valid', () => {
    // Load and parse the extension manifest file.
    const manifestPath = join(__dirname, '..', 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('LongTube');
    expect(manifest.content_scripts).toBeDefined();
    expect(manifest.content_scripts[0].matches).toContain('*://*.youtube.com/*');
  });

  test('content script should have required functions', () => {
    // Read the content script to verify it contains all required functions.
    const contentPath = join(__dirname, '..', 'src', 'content.js');
    const content = readFileSync(contentPath, 'utf8');

    // Verify that all essential functions are defined in the content script.
    expect(content).toContain('const checkAndRedirect =');
    expect(content).toContain('const injectBlockingCSS =');
    expect(content).toContain('const removeShortsFromDOM =');
    expect(content).toContain('const updateBlockedCount =');
    expect(content).toContain('chrome.runtime.onMessage.addListener');
  });

  test('popup should have required elements', () => {
    // Read the popup HTML to verify it contains all required UI elements.
    const popupPath = join(__dirname, '..', 'popup.html');
    const popup = readFileSync(popupPath, 'utf8');

    expect(popup).toContain('id="toggle"');
    expect(popup).toContain('id="status"');
    expect(popup).toContain('id="totalBlocked"');
    expect(popup).toContain('id="sessionBlocked"');
    expect(popup).toContain('id="timeSaved"');
    expect(popup).toContain('id="resetCount"');
    expect(popup).toContain('id="themeToggle"');
  });

  test('CSS should not contain invalid selectors', () => {
    // Read the content script to verify CSS selectors are valid.
    const contentPath = join(__dirname, '..', 'src', 'content.js');
    const content = readFileSync(contentPath, 'utf8');

    // Ensure that invalid pseudo-selectors like :has-text() are not used.
    expect(content).not.toContain(':has-text(');
  });
});
