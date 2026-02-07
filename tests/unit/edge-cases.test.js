import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Window } from 'happy-dom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const contentScript = readFileSync(join(__dirname, '../../src/content.js'), 'utf8');

const waitForAsyncWork = async () => {
  await new Promise((resolve) => setTimeout(resolve, 35));
};

const ORIGINAL_GLOBALS = {
  window: global.window,
  document: global.document,
  location: global.location,
  chrome: global.chrome,
  mutationObserver: global.MutationObserver,
};

const createMutationObserverFallback = () => {
  return class MutationObserverFallback {
    constructor(callback) {
      this.callback = callback;
      this.target = null;
      this.listener = null;
    }

    observe(target) {
      this.target = target;
      this.listener = () => {
        setTimeout(() => {
          this.callback([{ type: 'childList', target }], this);
        }, 0);
      };
      target.addEventListener('DOMNodeInserted', this.listener);
    }

    disconnect() {
      if (this.target && this.listener) {
        this.target.removeEventListener('DOMNodeInserted', this.listener);
      }
    }
  };
};

const createChromeMock = (storageData) => ({
  storage: {
    local: {
      get: (keys, callback) => {
        const result = {};
        const keyArray = Array.isArray(keys) ? keys : [keys];

        keyArray.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(storageData, key)) {
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
        Object.assign(storageData, items);
        if (callback) {
          callback();
          return undefined;
        }
        return Promise.resolve();
      },
    },
    onChanged: {
      addListener: () => {},
      removeListener: () => {},
    },
  },
  runtime: {
    onMessage: {
      addListener: () => {},
      removeListener: () => {},
    },
    lastError: null,
  },
});

const setupEnvironment = ({
  html = '',
  url = 'https://www.youtube.com/',
  initialStorage = { enabled: true, totalBlockedCount: 0 },
} = {}) => {
  const testWindow = new Window();
  global.window = testWindow;
  global.document = testWindow.document;
  global.location = testWindow.location;
  global.HTMLElement = testWindow.HTMLElement;
  const MutationObserverImpl = testWindow.MutationObserver || createMutationObserverFallback();
  global.MutationObserver = MutationObserverImpl;
  testWindow.MutationObserver = MutationObserverImpl;

  document.documentElement.innerHTML = '<head></head><body></body>';
  document.body.innerHTML = html;
  document.documentElement.className = '';

  const storageData = { ...initialStorage };
  global.chrome = createChromeMock(storageData);
  delete window.browserCompat;

  try {
    window.location.href = url;
  } catch {
    // Ignore URL assignment failures in test environment.
  }

  return storageData;
};

describe('Edge Cases', () => {
  afterEach(() => {
    global.window = ORIGINAL_GLOBALS.window;
    global.document = ORIGINAL_GLOBALS.document;
    global.location = ORIGINAL_GLOBALS.location;
    global.chrome = ORIGINAL_GLOBALS.chrome;
    global.MutationObserver = ORIGINAL_GLOBALS.mutationObserver;
  });

  beforeEach(() => {
    setupEnvironment();
  });

  test('handles empty pages without throwing and still injects styles', async () => {
    eval(contentScript);
    await waitForAsyncWork();

    expect(document.getElementById('longtube-blocking-styles')).toBeTruthy();
    expect(document.documentElement.classList.contains('longtube-active')).toBe(true);
  });

  test('handles large numbers of Shorts elements while preserving regular content', async () => {
    const shortsHtml = Array.from({ length: 120 })
      .map(
        (_, index) => `
          <ytd-video-renderer class="short-${index}">
            <a href="/shorts/${index}">Shorts ${index}</a>
          </ytd-video-renderer>
        `
      )
      .join('');

    const regularHtml = `
      <ytd-video-renderer id="regular-video">
        <a href="/watch?v=abc123">Regular Video</a>
      </ytd-video-renderer>
    `;

    setupEnvironment({ html: `${shortsHtml}${regularHtml}` });

    const start = Date.now();
    eval(contentScript);
    await waitForAsyncWork();
    const durationMs = Date.now() - start;

    expect(document.querySelectorAll('[href*="/shorts/"]').length).toBe(0);
    expect(document.getElementById('regular-video')).toBeTruthy();
    expect(durationMs).toBeLessThan(1500);
  });

  test('removes multiple Shorts surfaces in one pass', async () => {
    const storageData = setupEnvironment({
      html: `
        <ytd-video-renderer id="short-video">
          <a href="/shorts/short-1">Shorts Video</a>
        </ytd-video-renderer>
        <ytd-guide-entry-renderer id="short-nav">
          <a title="Shorts" href="/shorts/nav">Shorts Nav</a>
        </ytd-guide-entry-renderer>
        <yt-chip-cloud-chip-renderer id="short-chip">Shorts</yt-chip-cloud-chip-renderer>
        <ytd-video-renderer id="regular-video">
          <a href="/watch?v=abc123">Regular Video</a>
        </ytd-video-renderer>
      `,
    });

    eval(contentScript);
    await waitForAsyncWork();
    await waitForAsyncWork();

    expect(document.getElementById('short-video')).toBeNull();
    expect(document.getElementById('short-nav')).toBeNull();
    expect(document.getElementById('short-chip')).toBeNull();
    expect(document.getElementById('regular-video')).toBeTruthy();
    expect(storageData.totalBlockedCount).toBeGreaterThan(0);
  });

  test('redirect logic triggers for long and special-character Shorts URLs', async () => {
    const originalRandom = Math.random;

    setupEnvironment({
      url: 'https://www.youtube.com/shorts/abc-123_xyz-%E2%9C%85',
      html: '<div>Shorts page</div>',
    });

    try {
      Math.random = () => 0.5;

      eval(contentScript);
      await waitForAsyncWork();
    } finally {
      Math.random = originalRandom;
    }

    expect(window.location.pathname).toBe('/watch');
    expect(window.location.href).toContain('watch?v=');
  });

  test('keeps non-Shorts content and player elements intact', async () => {
    setupEnvironment({
      html: `
        <div id="movie_player" class="html5-video-player">
          <video src="/watch?v=123"></video>
        </div>
        <ytd-video-renderer id="regular-video">
          <a href="/watch?v=123">Regular Video</a>
        </ytd-video-renderer>
        <ytd-video-renderer id="short-video">
          <a href="/shorts/456">Shorts Video</a>
        </ytd-video-renderer>
      `,
    });

    eval(contentScript);
    await waitForAsyncWork();

    expect(document.getElementById('short-video')).toBeNull();
    expect(document.getElementById('regular-video')).toBeTruthy();
    expect(document.getElementById('movie_player')).toBeTruthy();
    expect(document.querySelector('#movie_player video')).toBeTruthy();
  });
});
