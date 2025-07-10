import puppeteer from 'puppeteer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '../..');

// Determine which extension path to use based on test mode
export function getExtensionPath() {
  // For CI and production tests, use the built extension
  const buildPath = join(projectRoot, 'build/chrome');
  const sourcePath = projectRoot;

  // Check if we should use the build directory (for CI)
  if (process.env.CI || process.env.USE_BUILD_EXTENSION) {
    return buildPath;
  }

  // For local development, prefer source if manifest exists
  if (existsSync(join(sourcePath, 'manifest.json'))) {
    return sourcePath;
  }

  // Fall back to build directory
  return buildPath;
}

const extensionPath = getExtensionPath();

// Ensure extension is built before running tests
export function ensureExtensionBuilt() {
  const manifestPath = join(extensionPath, 'manifest.json');

  // If using build directory and it doesn't exist, build it
  if (extensionPath.includes('build/chrome') && !existsSync(manifestPath)) {
    console.log('Building extension for tests...');
    try {
      execSync('bun run build', { cwd: projectRoot, stdio: 'inherit' });
    } catch (error) {
      console.error('Failed to build extension:', error.message);
      throw error;
    }
  }

  // Final check
  if (!existsSync(manifestPath)) {
    console.log('Extension manifest not found at:', manifestPath);
    throw new Error(
      'Extension manifest not found. Please ensure the extension is properly set up.'
    );
  }

  console.log('Extension found at:', extensionPath);
}

// Launch Chrome with the extension loaded
export async function launchChromeWithExtension() {
  ensureExtensionBuilt();

  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-software-rasterizer',
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    '--enable-logging',
    '--v=1',
  ];

  const browser = await puppeteer.launch({
    headless: false, // Extensions require headful mode (we use xvfb in CI)
    args,
    defaultViewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
    dumpio: false,
    protocolTimeout: 300000, // 5 minutes
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });

  // Set up a cleanup handler
  const cleanup = async () => {
    try {
      const pages = await browser.pages();
      for (const page of pages) {
        if (!page.isClosed()) {
          await page.close().catch(() => {});
        }
      }
      await browser.close();
    } catch {
      // Ignore errors during cleanup
    }
  };

  // Handle unexpected exits
  process.on('beforeExit', cleanup);
  process.on('exit', cleanup);

  return browser;
}

// Create a new page with proper error handling
export async function createPage(browser) {
  const page = await browser.newPage();

  // Set up error handlers
  page.on('error', (err) => {
    console.error('Page crashed:', err);
  });

  page.on('pageerror', (err) => {
    // Only log non-extension errors
    if (!err.message?.includes('chrome-extension://')) {
      console.error('Page error:', err);
    }
  });

  // Set reasonable timeouts
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(30000);

  // Keep connection alive
  page.on('close', () => {
    console.log('Page closed');
  });

  return page;
}

// Safe page close
export async function closePage(page) {
  if (page && !page.isClosed()) {
    try {
      await page.close();
    } catch {
      // Ignore errors when closing
    }
  }
}

// Safe browser close
export async function closeBrowser(browser) {
  if (browser) {
    try {
      const pages = await browser.pages();
      for (const page of pages) {
        await closePage(page);
      }
      await browser.close();
    } catch {
      // Force close if needed
      try {
        await browser.close();
      } catch {
        // Ignore
      }
    }
  }
}

// Wait for extension to be ready
export async function waitForExtension(page, timeout = 5000) {
  try {
    await page.waitForFunction(
      () => {
        return window.chrome && window.chrome.storage && window.chrome.storage.local;
      },
      { timeout }
    );

    // Inject a helper to handle storage API safely
    await page.evaluate(() => {
      if (!window.safeStorage) {
        window.safeStorage = {
          get: (keys) => {
            return new Promise((resolve) => {
              if (window.chrome && window.chrome.storage && window.chrome.storage.local) {
                window.chrome.storage.local.get(keys, resolve);
              } else {
                resolve({});
              }
            });
          },
          set: (data) => {
            return new Promise((resolve) => {
              if (window.chrome && window.chrome.storage && window.chrome.storage.local) {
                window.chrome.storage.local.set(data, resolve);
              } else {
                resolve();
              }
            });
          },
        };
      }
    });
  } catch {
    // Extension might not be injected on all pages, which is okay
    console.log('Extension not detected on page (this may be expected)');
  }
}

// Get extension ID from browser (improved for Manifest V3)
export async function getExtensionId(browser, retries = 3) {
  // For Manifest V3, we can't reliably get the extension ID from targets
  // Instead, we'll verify the extension is working by checking its effects
  console.log('Note: Extension ID detection is not reliable for Manifest V3');
  console.log('Tests will verify extension functionality instead');

  // Try to detect extension for compatibility
  for (let i = 0; i < retries; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const targets = await browser.targets();

    // Look for service workers (Manifest V3)
    const serviceWorker = targets.find((target) => {
      return target.type() === 'service_worker' && target.url().includes('chrome-extension://');
    });

    if (serviceWorker) {
      const match = serviceWorker.url().match(/chrome-extension:\/\/([^/]+)/);
      if (match && match[1]) {
        console.log('Extension ID found from service worker:', match[1]);
        return match[1];
      }
    }

    // For Manifest V2 compatibility
    const backgroundPage = targets.find((target) => {
      return target.type() === 'background_page' && target.url().includes('chrome-extension://');
    });

    if (backgroundPage) {
      const match = backgroundPage.url().match(/chrome-extension:\/\/([^/]+)/);
      if (match && match[1]) {
        console.log('Extension ID found from background page:', match[1]);
        return match[1];
      }
    }
  }

  // Return null - tests should verify functionality instead of relying on ID
  return null;
}

// Wait for specific extension elements
export async function waitForExtensionElement(page, selector, options = {}) {
  const { timeout = 5000, visible = false } = options;

  try {
    if (visible) {
      await page.waitForSelector(selector, { visible: true, timeout });
    } else {
      await page.waitForFunction(
        (sel) => document.querySelector(sel) !== null,
        { timeout },
        selector
      );
    }
    return true;
  } catch {
    console.log(`Element ${selector} not found after ${timeout}ms`);
    return false;
  }
}

// Wait for extension to be ready on YouTube
export async function waitForExtensionReady(page, options = {}) {
  const { timeout = 10000 } = options;

  try {
    // Wait for the blocking CSS to be injected
    await page.waitForFunction(
      () => {
        const style = document.getElementById('longtube-blocking-styles');
        return style && style.textContent && style.textContent.length > 0;
      },
      { timeout }
    );

    // Wait for the active class to be applied
    await page.waitForFunction(
      () => document.documentElement.classList.contains('longtube-active'),
      { timeout: timeout / 2 }
    );

    return true;
  } catch (error) {
    console.log('Extension not ready:', error.message);
    return false;
  }
}

// Verify extension is loaded and working
export async function verifyExtensionLoaded(page, options = {}) {
  const { checkCSS = true, checkActiveClass = true, timeout = 5000 } = options;

  try {
    await page.goto('https://www.youtube.com', { waitUntil: 'domcontentloaded' });

    // Wait for extension to inject its elements
    await page.waitForFunction(() => document.getElementById('longtube-blocking-styles') !== null, {
      timeout,
    });

    const checks = await page.evaluate(
      (opts) => {
        const results = {};

        if (opts.checkCSS) {
          results.hasBlockingCSS = !!document.getElementById('longtube-blocking-styles');
        }

        if (opts.checkActiveClass) {
          results.hasActiveClass = document.documentElement.classList.contains('longtube-active');
        }

        return results;
      },
      { checkCSS, checkActiveClass }
    );

    const allChecksPassed = Object.values(checks).every((v) => v === true);

    if (!allChecksPassed) {
      console.log('Extension verification failed:', checks);
    }

    return allChecksPassed;
  } catch (error) {
    console.error('Extension verification error:', error.message);
    return false;
  }
}
