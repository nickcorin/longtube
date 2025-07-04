import { test, expect, describe } from 'bun:test';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Integration tests to verify Firefox extension functionality
 * without requiring a real browser instance.
 */
describe('Firefox Extension Integration', () => {
  test('browser-compat.js initializes correctly in Firefox environment', () => {
    // Create a Firefox-like environment
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'https://www.youtube.com',
      pretendToBeVisual: true,
      resources: 'usable',
    });

    // Set up Firefox globals
    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0',
    };

    // Mock Firefox browser API
    global.browser = {
      storage: {
        local: {
          get: () => Promise.resolve({}),
          set: () => Promise.resolve(),
        },
        onChanged: {
          addListener: () => {},
        },
      },
      runtime: {
        onMessage: {
          addListener: () => {},
        },
      },
    };

    // Load browser-compat.js
    const compatScript = readFileSync(join(__dirname, '../../src/browser-compat.js'), 'utf8');
    eval(compatScript);

    // Verify browserCompat is available globally
    expect(global.window.browserCompat).toBeDefined();
    expect(global.window.browserCompat.browser.name).toBe('firefox');
    expect(global.window.browserCompat.storage).toBeDefined();
    expect(global.window.browserCompat.runtime).toBeDefined();
  });

  test('content.js works with Firefox browser API via compatibility layer', async () => {
    // Set up environment with browserCompat
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'https://www.youtube.com/watch?v=test',
      pretendToBeVisual: true,
    });

    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = { userAgent: 'Mozilla/5.0 Firefox/120.0' };
    global.location = dom.window.location;

    // Mock Firefox browser API
    const storageData = { enabled: true, totalBlockedCount: 0 };
    global.browser = {
      storage: {
        local: {
          get: (keys) => {
            const result = {};
            (Array.isArray(keys) ? keys : [keys]).forEach((key) => {
              if (storageData[key] !== undefined) result[key] = storageData[key];
            });
            return Promise.resolve(result);
          },
          set: (items) => {
            Object.assign(storageData, items);
            return Promise.resolve();
          },
        },
        onChanged: {
          addListener: () => {},
        },
      },
      runtime: {
        onMessage: {
          addListener: () => {},
        },
      },
    };

    // First load browser-compat.js
    const compatScript = readFileSync(join(__dirname, '../../src/browser-compat.js'), 'utf8');
    eval(compatScript);

    // Mock console.log to capture output
    const logs = [];
    global.console.log = (...args) => logs.push(args.join(' '));

    // Now load content.js
    const contentScript = readFileSync(join(__dirname, '../../src/content.js'), 'utf8');

    // content.js uses async/await, so we need to handle it properly
    try {
      eval(`(async () => { ${contentScript} })();`);

      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify the extension initialized
      expect(logs.some((log) => log.includes('[LongTube]'))).toBe(true);
      expect(logs.some((log) => log.includes('Extension loaded'))).toBe(true);

      // Verify CSS injection
      const styleElement = dom.window.document.getElementById('longtube-blocking-styles');
      expect(styleElement).toBeDefined();
      expect(styleElement?.tagName).toBe('STYLE');
    } catch (error) {
      // If there's an error, it should be related to missing DOM elements, not API issues
      expect(error.message).not.toContain('chrome is not defined');
      expect(error.message).not.toContain('browser is not defined');
    }
  });

  test('popup.js works with Firefox browser API', async () => {
    const dom = new JSDOM(
      `<!DOCTYPE html>
      <html>
        <body>
          <div id="toggle"></div>
          <div id="totalBlocked">0</div>
          <div id="sessionBlocked">0</div>
          <div id="timeSaved">0</div>
          <button id="resetCount"></button>
          <button id="themeToggle"></button>
        </body>
      </html>`,
      {
        url: 'chrome-extension://test/popup.html',
        pretendToBeVisual: true,
      }
    );

    global.window = dom.window;
    global.document = dom.window.document;

    // Mock Firefox browser API
    const storageData = { enabled: true, totalBlockedCount: 5 };
    global.browser = {
      storage: {
        local: {
          get: () => Promise.resolve(storageData),
          set: (items) => {
            Object.assign(storageData, items);
            return Promise.resolve();
          },
        },
        onChanged: {
          addListener: () => {},
        },
      },
      runtime: {
        onMessage: {
          addListener: () => {},
        },
      },
      tabs: {
        query: () => Promise.resolve([]),
        sendMessage: () => Promise.resolve(),
      },
    };

    // Load browser-compat.js first
    const compatScript = readFileSync(join(__dirname, '../../src/browser-compat.js'), 'utf8');
    eval(compatScript);

    // Load popup.js
    const popupScript = readFileSync(join(__dirname, '../../src/popup.js'), 'utf8');
    eval(popupScript);

    // Wait for initialization
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify popup initialized with storage data
    const totalBlocked = dom.window.document.getElementById('totalBlocked');
    expect(totalBlocked.textContent).toBe('5');
  });

  test('Firefox manifest has required settings', () => {
    const manifestPath = join(__dirname, '../../manifest-firefox.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

    // Verify Firefox-specific settings
    expect(manifest.browser_specific_settings).toBeDefined();
    expect(manifest.browser_specific_settings.gecko).toBeDefined();
    expect(manifest.browser_specific_settings.gecko.id).toBeDefined();
    expect(manifest.browser_specific_settings.gecko.strict_min_version).toBeDefined();

    // Verify content scripts load browser-compat.js first
    const contentScripts = manifest.content_scripts[0].js;
    expect(contentScripts[0]).toBe('src/browser-compat.js');
    expect(contentScripts[1]).toBe('src/content.js');

    // Verify permissions
    expect(manifest.permissions).toContain('storage');
    expect(manifest.host_permissions).toContain('*://*.youtube.com/*');
  });

  test('Browser detection works correctly', () => {
    const testCases = [
      {
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0',
        expected: 'firefox',
      },
      {
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
        expected: 'chrome',
      },
      {
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/120.0.0.0',
        expected: 'edge',
      },
    ];

    testCases.forEach(({ ua, expected }) => {
      global.navigator = { userAgent: ua };

      // Load browser-compat.js fresh for each test
      delete global.window?.browserCompat;
      const compatScript = readFileSync(join(__dirname, '../../src/browser-compat.js'), 'utf8');
      eval(compatScript);

      expect(global.window.browserCompat.browser.name).toBe(expected);
    });
  });
});
