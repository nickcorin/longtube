import puppeteer from 'puppeteer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '../..');
const buildPath = join(projectRoot, 'build/chrome');
const sourcePath = projectRoot;

export function getExtensionPath() {
  if (process.env.CI || process.env.USE_BUILD_EXTENSION) {
    return buildPath;
  }

  return existsSync(join(sourcePath, 'manifest.json')) ? sourcePath : buildPath;
}

export function ensureExtensionBuilt() {
  const extensionPath = getExtensionPath();
  const manifestPath = join(extensionPath, 'manifest.json');

  if (extensionPath === buildPath && !existsSync(manifestPath)) {
    execSync('bun run build', { cwd: projectRoot, stdio: 'inherit' });
  }

  if (!existsSync(manifestPath)) {
    throw new Error(`Extension manifest not found at ${manifestPath}`);
  }

  return extensionPath;
}

export async function launchChromeWithExtension() {
  const extensionPath = ensureExtensionBuilt();

  return puppeteer.launch({
    headless: false,
    args: [
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
    ],
    defaultViewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
    dumpio: false,
    protocolTimeout: 300000,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });
}

export async function createPage(browser) {
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(30000);

  page.on('pageerror', (error) => {
    const message = error?.message || '';
    if (!message.includes('chrome-extension://')) {
      console.error('Page error:', error);
    }
  });

  return page;
}

export async function closePage(page) {
  if (!page || page.isClosed()) {
    return;
  }
  await page.close().catch(() => {});
}

export async function closeBrowser(browser) {
  if (!browser) {
    return;
  }

  const pages = await browser.pages().catch(() => []);
  await Promise.all(pages.map((page) => closePage(page)));
  await browser.close().catch(() => {});
}

export async function waitForExtension(page, timeout = 5000) {
  try {
    await page.waitForFunction(() => !!window.chrome?.storage?.local, { timeout });
    return true;
  } catch {
    return false;
  }
}

const getIdFromTargets = (targets) => {
  for (const type of ['service_worker', 'background_page']) {
    const target = targets.find((item) => {
      return item.type() === type && item.url().startsWith('chrome-extension://');
    });
    const match = target?.url().match(/chrome-extension:\/\/([^/]+)/);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
};

export async function getExtensionId(browser, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const extensionId = getIdFromTargets(await browser.targets());
    if (extensionId) {
      return extensionId;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return null;
}

export async function waitForExtensionElement(page, selector, options = {}) {
  const { timeout = 5000, visible = false } = options;

  try {
    if (visible) {
      await page.waitForSelector(selector, { visible: true, timeout });
    } else {
      await page.waitForFunction((sel) => !!document.querySelector(sel), { timeout }, selector);
    }
    return true;
  } catch {
    return false;
  }
}

export async function waitForExtensionReady(page, options = {}) {
  const { timeout = 10000 } = options;

  try {
    await page.waitForFunction(
      () => {
        const style = document.getElementById('longtube-blocking-styles');
        return !!style?.textContent?.length;
      },
      { timeout }
    );

    await page.waitForFunction(
      () => document.documentElement.classList.contains('longtube-active'),
      { timeout: timeout / 2 }
    );

    return true;
  } catch {
    return false;
  }
}

export async function verifyExtensionLoaded(page, options = {}) {
  const { checkCSS = true, checkActiveClass = true, timeout = 5000 } = options;

  try {
    await page.goto('https://www.youtube.com', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('longtube-blocking-styles') !== null, {
      timeout,
    });

    const checks = await page.evaluate(
      (opts) => {
        return {
          hasBlockingCSS: opts.checkCSS
            ? !!document.getElementById('longtube-blocking-styles')
            : true,
          hasActiveClass: opts.checkActiveClass
            ? document.documentElement.classList.contains('longtube-active')
            : true,
        };
      },
      { checkCSS, checkActiveClass }
    );

    return Object.values(checks).every(Boolean);
  } catch {
    return false;
  }
}
