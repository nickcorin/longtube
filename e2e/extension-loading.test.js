import { test, expect, describe, beforeAll, afterAll } from 'bun:test';
import puppeteer from 'puppeteer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const extensionPath = join(__dirname, '..');

/**
 * End-to-end tests for the LongTube extension loading and initialization.
 * These tests verify that the extension loads correctly in a real browser
 * and initializes its core functionality on YouTube pages.
 */

describe('Extension Loading', () => {
  let browser;
  let page;

  beforeAll(async () => {
    // Launch Chrome browser with the LongTube extension loaded.
    browser = await puppeteer.launch({
      headless: false, // Extensions require headful mode
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });

    // Create a new browser page for testing.
    page = await browser.newPage();

    // Set a standard desktop viewport size.
    await page.setViewport({ width: 1280, height: 720 });
  }, 30000); // Allow 30 seconds for browser launch to accommodate slower systems.

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('should load extension in browser', async () => {
    // Navigate to YouTube homepage to test extension loading.
    await page.goto('https://www.youtube.com', { waitUntil: 'networkidle2' });

    // Allow time for the extension to initialize after page load.
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify that the extension has injected its CSS into the page.
    const hasExtensionCSS = await page.evaluate(() => {
      return !!document.getElementById('longtube-blocking-styles');
    });

    expect(hasExtensionCSS).toBe(true);
  }, 15000);

  test('should add longtube-active class when enabled', async () => {
    await page.goto('https://www.youtube.com', { waitUntil: 'networkidle2' });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify that the extension applies its active class to enable blocking.
    const hasActiveClass = await page.evaluate(() => {
      return document.documentElement.classList.contains('longtube-active');
    });

    expect(hasActiveClass).toBe(true);
  }, 15000);
});

/**
 * End-to-end tests for Shorts blocking functionality.
 * These tests verify that the extension successfully blocks various
 * Shorts elements and redirects from Shorts pages.
 */

describe('Shorts Blocking E2E', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });

    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
  }, 30000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('should hide Shorts from YouTube homepage', async () => {
    await page.goto('https://www.youtube.com', { waitUntil: 'networkidle2' });

    // Wait for YouTube's main app component to load.
    await page.waitForSelector('ytd-app', { timeout: 10000 });
    await new Promise((resolve) => setTimeout(resolve, 3000)); // Allow time for dynamic content to load.

    // Verify that Shorts shelf elements are hidden by the extension.
    const shortsShelfVisible = await page.evaluate(() => {
      const shelves = document.querySelectorAll(
        'ytd-rich-shelf-renderer[is-shorts], ytd-reel-shelf-renderer'
      );
      return Array.from(shelves).some((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
    });

    expect(shortsShelfVisible).toBe(false);

    // Verify that individual Shorts video links are also hidden.
    const shortsLinksVisible = await page.evaluate(() => {
      const links = document.querySelectorAll('[href*="/shorts/"]');
      return Array.from(links).some((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
    });

    expect(shortsLinksVisible).toBe(false);
  }, 20000);

  test('should redirect from Shorts URLs', async () => {
    // Attempt to navigate directly to a Shorts URL.
    await page.goto('https://www.youtube.com/shorts/test123', {
      waitUntil: 'networkidle2',
      timeout: 10000,
    });

    // Allow time for the extension to detect and redirect from the Shorts page.
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify that we were redirected away from the Shorts URL.
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/shorts/');

    // Confirm that the redirect went to one of the configured video URLs.
    const isRickRoll = currentUrl.includes('watch?v=dQw4w9WgXcQ');
    const isOtherVideo = currentUrl.includes('watch?v=9Deg7VrpHbM');
    expect(isRickRoll || isOtherVideo).toBe(true);
  }, 15000);

  test('should remove Shorts navigation items', async () => {
    await page.goto('https://www.youtube.com', { waitUntil: 'networkidle2' });
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Verify that Shorts navigation items in the sidebar are hidden.
    const shortsNavVisible = await page.evaluate(() => {
      const navItems = document.querySelectorAll('[title="Shorts"], [aria-label*="Shorts"]');
      return Array.from(navItems).some((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
    });

    expect(shortsNavVisible).toBe(false);
  }, 15000);
});
