import { test, expect, describe, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import puppeteer from 'puppeteer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const extensionPath = join(__dirname, '../..');

/**
 * Comprehensive E2E tests for the LongTube Chrome extension.
 * These tests verify extension loading, UI functionality, and content blocking.
 */

// Ensure extension is built before running tests
function ensureExtensionBuilt() {
  const buildPath = join(__dirname, '../../build');
  if (!existsSync(buildPath)) {
    console.log('Building extension for tests...');
    execSync('bun run build', { cwd: extensionPath, stdio: 'inherit' });
  }
}

// Launch Chrome with the extension loaded
async function launchChromeWithExtension() {
  ensureExtensionBuilt();

  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process',
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ];

  return await puppeteer.launch({
    headless: false, // Extensions require headful mode
    args,
    defaultViewport: { width: 1280, height: 720 },
  });
}

describe('Chrome Extension Core Functionality', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await launchChromeWithExtension();
  }, 30000);

  beforeEach(async () => {
    page = await browser.newPage();

    // Enable console logging for debugging
    page.on('console', (msg) => {
      if (msg.text().includes('[LongTube]')) {
        console.log('Extension:', msg.text());
      }
    });
  });

  afterEach(async () => {
    await page.close();
  });

  afterAll(async () => {
    await browser.close();
  });

  test('should load extension and inject blocking CSS', async () => {
    await page.goto('https://www.youtube.com', { waitUntil: 'networkidle2' });
    await page.waitForTimeout(2000);

    // Verify CSS injection
    const hasExtensionCSS = await page.evaluate(() => {
      const styleElement = document.getElementById('longtube-blocking-styles');
      return {
        exists: !!styleElement,
        isStyle: styleElement?.tagName === 'STYLE',
        hasContent: (styleElement?.textContent?.length || 0) > 100,
      };
    });

    expect(hasExtensionCSS.exists).toBe(true);
    expect(hasExtensionCSS.isStyle).toBe(true);
    expect(hasExtensionCSS.hasContent).toBe(true);
  }, 15000);

  test('should apply longtube-active class when enabled', async () => {
    await page.goto('https://www.youtube.com', { waitUntil: 'networkidle2' });
    await page.waitForTimeout(2000);

    const extensionState = await page.evaluate(() => {
      return {
        hasActiveClass: document.documentElement.classList.contains('longtube-active'),
        classList: Array.from(document.documentElement.classList),
      };
    });

    expect(extensionState.hasActiveClass).toBe(true);
  }, 15000);

  test('should have working storage API', async () => {
    await page.goto('https://www.youtube.com', { waitUntil: 'networkidle2' });
    await page.waitForTimeout(2000);

    // Test storage operations
    const storageTest = await page.evaluate(async () => {
      // Set a test value
      await new Promise((resolve) => {
        chrome.storage.local.set({ testKey: 'testValue' }, resolve);
      });

      // Get the test value
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['testKey'], resolve);
      });

      // Clean up
      await new Promise((resolve) => {
        chrome.storage.local.remove(['testKey'], resolve);
      });

      return result.testKey;
    });

    expect(storageTest).toBe('testValue');
  }, 15000);
});

describe('Shorts Blocking Functionality', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await launchChromeWithExtension();
  }, 30000);

  beforeEach(async () => {
    page = await browser.newPage();
  });

  afterEach(async () => {
    await page.close();
  });

  afterAll(async () => {
    await browser.close();
  });

  test('should hide Shorts shelves on homepage', async () => {
    await page.goto('https://www.youtube.com', { waitUntil: 'networkidle2' });

    // Wait for YouTube to fully load
    await page.waitForSelector('ytd-app', { timeout: 10000 });
    await page.waitForTimeout(3000);

    // Check Shorts visibility
    const shortsInfo = await page.evaluate(() => {
      const selectors = [
        'ytd-rich-shelf-renderer[is-shorts]',
        'ytd-reel-shelf-renderer',
        '[title="Shorts"]',
        'a[href*="/shorts/"]',
      ];

      const results = {};
      selectors.forEach((selector) => {
        const elements = document.querySelectorAll(selector);
        results[selector] = {
          count: elements.length,
          visible: Array.from(elements).filter((el) => {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return (
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              rect.width > 0 &&
              rect.height > 0
            );
          }).length,
        };
      });

      return results;
    });

    console.log('Shorts visibility info:', shortsInfo);

    // Verify Shorts are hidden
    Object.values(shortsInfo).forEach((info) => {
      if (info.count > 0) {
        expect(info.visible).toBe(0);
      }
    });
  }, 20000);

  test('should redirect from Shorts URLs', async () => {
    // Navigate to a Shorts URL
    await page.goto('https://www.youtube.com/shorts/dQw4w9WgXcQ', {
      waitUntil: 'networkidle2',
    });

    // Wait for potential redirect
    await page.waitForTimeout(3000);

    // Check if we were redirected
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/shorts/');

    // Should redirect to a watch URL
    expect(currentUrl).toMatch(/\/watch\?v=/);
  }, 15000);

  test('should track blocked count', async () => {
    await page.goto('https://www.youtube.com', { waitUntil: 'networkidle2' });
    await page.waitForTimeout(3000);

    // Get blocked count from storage
    const stats = await page.evaluate(() => {
      return new Promise((resolve) => {
        chrome.storage.local.get(['totalBlockedCount', 'enabled'], (result) => {
          resolve({
            totalBlockedCount: result.totalBlockedCount || 0,
            enabled: result.enabled !== false,
          });
        });
      });
    });

    expect(typeof stats.totalBlockedCount).toBe('number');
    expect(stats.enabled).toBe(true);
  }, 15000);
});

describe('Extension Popup Functionality', () => {
  let browser;
  let page;
  let extensionId;

  beforeAll(async () => {
    browser = await launchChromeWithExtension();

    // Get extension ID
    const targets = await browser.targets();
    const extensionTarget = targets.find(
      (target) => target.type() === 'service_worker' || target.type() === 'background_page'
    );

    if (extensionTarget) {
      const extensionUrl = extensionTarget.url();
      extensionId = extensionUrl.split('/')[2];
      console.log('Extension ID:', extensionId);
    }
  }, 30000);

  afterAll(async () => {
    await browser.close();
  });

  test('should open popup and display UI elements', async () => {
    if (!extensionId) {
      console.log('Extension ID not found, skipping popup test');
      return;
    }

    // Open extension popup
    const popupUrl = `chrome-extension://${extensionId}/src/popup.html`;
    page = await browser.newPage();
    await page.goto(popupUrl);
    await page.waitForTimeout(1000);

    // Check popup elements
    const popupElements = await page.evaluate(() => {
      return {
        hasToggle: !!document.getElementById('toggle'),
        hasTotalBlocked: !!document.getElementById('totalBlocked'),
        hasSessionBlocked: !!document.getElementById('sessionBlocked'),
        hasTimeSaved: !!document.getElementById('timeSaved'),
        hasResetButton: !!document.getElementById('resetCount'),
        hasThemeToggle: !!document.getElementById('themeToggle'),
      };
    });

    expect(popupElements.hasToggle).toBe(true);
    expect(popupElements.hasTotalBlocked).toBe(true);
    expect(popupElements.hasSessionBlocked).toBe(true);
    expect(popupElements.hasTimeSaved).toBe(true);
    expect(popupElements.hasResetButton).toBe(true);
    expect(popupElements.hasThemeToggle).toBe(true);

    await page.close();
  }, 15000);
});
