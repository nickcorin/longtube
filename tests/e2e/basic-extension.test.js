import { test, expect, describe, beforeAll, afterAll } from 'bun:test';
import { launchChromeWithExtension, closeBrowser, getExtensionPath } from './test-helpers.js';
import { join } from 'path';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';

const extensionPath = getExtensionPath();

/**
 * Lean smoke tests for the LongTube Chrome extension.
 * These tests intentionally keep broad coverage with minimal browser startups.
 */

describe('Extension Smoke', () => {
  let browser;

  beforeAll(async () => {
    browser = await launchChromeWithExtension();
  }, 30000);

  afterAll(async () => {
    await closeBrowser(browser);
  });

  test('should include required manifest and popup assets', async () => {
    const manifestPath = join(extensionPath, 'manifest.json');
    const popupHtmlPath = join(extensionPath, 'src/popup.html');
    const popupJsPath = join(extensionPath, 'src/popup.js');

    expect(existsSync(manifestPath)).toBe(true);
    expect(existsSync(popupHtmlPath)).toBe(true);
    expect(existsSync(popupJsPath)).toBe(true);

    const manifestContent = await readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('LongTube');
    expect(manifest.permissions).toContain('storage');
    expect(manifest.content_scripts).toBeDefined();
    expect(manifest.content_scripts[0].matches).toContain('*://*.youtube.com/*');

    const popupHtml = await readFile(popupHtmlPath, 'utf8');
    expect(popupHtml).toContain('id="toggle"');
    expect(popupHtml).toContain('class="stats-grid"');
    expect(popupHtml).toContain('<h1>LongTube</h1>');
  });

  test('should inject blocking styles on YouTube with extension active', async () => {
    const page = await browser.newPage();

    try {
      await page.goto('https://www.youtube.com', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(
        () => document.getElementById('longtube-blocking-styles') !== null,
        {
          timeout: 10000,
        }
      );

      const extensionState = await page.evaluate(() => ({
        hasBlockingStyle: !!document.getElementById('longtube-blocking-styles'),
        hasActiveClass: document.documentElement.classList.contains('longtube-active'),
      }));

      expect(extensionState.hasBlockingStyle).toBe(true);
      expect(extensionState.hasActiveClass).toBe(true);
    } finally {
      await page.close();
    }
  }, 15000);
});
