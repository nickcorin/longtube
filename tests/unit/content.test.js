import { test, expect, describe, beforeEach } from 'bun:test';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Window } from 'happy-dom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const contentScript = readFileSync(join(__dirname, '../../src/content.js'), 'utf8');

const waitForAsyncWork = async () => {
  await new Promise((resolve) => setTimeout(resolve, 25));
};

describe('LongTube Content Script', () => {
  let messageListener;
  let storageChangeListener;
  let reloadCalled;
  let storageData;

  beforeEach(() => {
    const testWindow = new Window();
    global.window = testWindow;
    global.document = testWindow.document;
    global.HTMLElement = testWindow.HTMLElement;
    global.MutationObserver = testWindow.MutationObserver;
    global.location = testWindow.location;

    document.documentElement.innerHTML = '<head></head><body></body>';
    document.documentElement.className = '';

    messageListener = null;
    storageChangeListener = null;
    reloadCalled = false;
    storageData = {
      enabled: true,
      totalBlockedCount: 0,
    };

    delete window.browserCompat;

    global.chrome = {
      storage: {
        local: {
          data: storageData,
          get: (keys, callback) => {
            const result = {};
            const keyArray = Array.isArray(keys) ? keys : [keys];

            keyArray.forEach((key) => {
              if (storageData[key] !== undefined) {
                result[key] = storageData[key];
              }
            });

            if (callback) {
              callback(result);
              return undefined;
            }

            return Promise.resolve(result);
          },
          set: (items, callback) => {
            const previous = { ...storageData };
            Object.assign(storageData, items);

            if (storageChangeListener) {
              const changes = {};
              Object.keys(items).forEach((key) => {
                changes[key] = {
                  oldValue: previous[key],
                  newValue: storageData[key],
                };
              });
              setTimeout(() => storageChangeListener(changes, 'local'), 0);
            }

            if (callback) {
              callback();
              return undefined;
            }

            return Promise.resolve();
          },
        },
        onChanged: {
          addListener: (listener) => {
            storageChangeListener = listener;
          },
          removeListener: () => {},
        },
      },
      runtime: {
        onMessage: {
          addListener: (listener) => {
            messageListener = listener;
          },
          removeListener: () => {},
        },
        lastError: null,
      },
    };

    try {
      window.location.href = 'https://www.youtube.com/';
    } catch {
      // Ignore URL assignment failures in non-navigation test environments.
    }

    try {
      window.location.reload = () => {
        reloadCalled = true;
      };
    } catch {
      Object.defineProperty(window.location, 'reload', {
        value: () => {
          reloadCalled = true;
        },
        configurable: true,
      });
    }
  });

  test('injects blocking CSS and removes Shorts content from DOM', async () => {
    document.body.innerHTML = `
      <ytd-video-renderer id="shorts-video">
        <a href="/shorts/123">Shorts Video</a>
      </ytd-video-renderer>
      <ytd-video-renderer id="regular-video">
        <a href="/watch?v=456">Regular Video</a>
      </ytd-video-renderer>
      <ytd-rich-shelf-renderer is-shorts id="shorts-shelf">Shorts Shelf</ytd-rich-shelf-renderer>
    `;

    eval(contentScript);
    await waitForAsyncWork();

    const style = document.getElementById('longtube-blocking-styles');
    expect(style).toBeTruthy();
    expect(style.textContent).toContain('[href*="/shorts/"]');
    expect(document.documentElement.classList.contains('longtube-active')).toBe(true);

    expect(document.getElementById('shorts-video')).toBeNull();
    expect(document.getElementById('shorts-shelf')).toBeNull();
    expect(document.getElementById('regular-video')).toBeTruthy();
    expect(storageData.totalBlockedCount).toBeGreaterThan(0);
  });

  test('registers runtime message listener and handles getStatus', async () => {
    eval(contentScript);
    await waitForAsyncWork();

    expect(typeof messageListener).toBe('function');

    let response = null;
    messageListener({ action: 'getStatus' }, null, (payload) => {
      response = payload;
    });

    expect(response).toBeTruthy();
    expect(response.isEnabled).toBe(true);
    expect(typeof response.pageBlockedCount).toBe('number');
  });

  test('handles toggleBlocking message and persists enabled state', async () => {
    eval(contentScript);
    await waitForAsyncWork();

    messageListener({ action: 'toggleBlocking', enabled: false }, null, () => {});
    await waitForAsyncWork();

    expect(storageData.enabled).toBe(false);
    expect(reloadCalled).toBe(true);
  });

  test('reloads page when enabled changes via storage event', async () => {
    eval(contentScript);
    await waitForAsyncWork();

    expect(typeof storageChangeListener).toBe('function');
    storageChangeListener({ enabled: { oldValue: true, newValue: false } }, 'local');
    await waitForAsyncWork();

    expect(reloadCalled).toBe(true);
  });

  test('redirects away from Shorts pages when enabled', async () => {
    const originalMathRandom = Math.random;

    try {
      Math.random = () => 0.5;
      window.location.href = 'https://www.youtube.com/shorts/abc123';

      eval(contentScript);
      await waitForAsyncWork();

      expect(window.location.pathname).toBe('/watch');
      expect(window.location.href).toContain('watch?v=');
    } finally {
      Math.random = originalMathRandom;
    }
  });
});
