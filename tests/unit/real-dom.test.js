import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Window } from 'happy-dom';

/**
 * Tests using real YouTube HTML structure fixtures.
 * These tests verify that the extension correctly identifies and removes
 * Shorts content from actual YouTube page structures.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const contentScript = readFileSync(join(__dirname, '../../src/content.js'), 'utf8');
const fixturePath = join(__dirname, 'fixtures/youtube-homepage.html');

const waitForAsyncWork = async () => {
  await new Promise((resolve) => setTimeout(resolve, 40));
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
        const keyArray = Array.isArray(keys) ? keys : [keys];
        const result = {};
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

describe('Real YouTube DOM Tests', () => {
  let youtubeHTML;
  let storageData;

  beforeEach(() => {
    const testWindow = new Window();
    global.window = testWindow;
    global.document = testWindow.document;
    global.location = testWindow.location;
    global.HTMLElement = testWindow.HTMLElement;
    const MutationObserverImpl = testWindow.MutationObserver || createMutationObserverFallback();
    global.MutationObserver = MutationObserverImpl;
    testWindow.MutationObserver = MutationObserverImpl;

    youtubeHTML = readFileSync(fixturePath, 'utf8');
    document.documentElement.innerHTML = '<head></head><body></body>';
    document.body.innerHTML = youtubeHTML;
    document.documentElement.className = '';
    storageData = { enabled: true, totalBlockedCount: 0 };
    global.chrome = createChromeMock(storageData);
    delete window.browserCompat;
  });

  afterEach(() => {
    global.window = ORIGINAL_GLOBALS.window;
    global.document = ORIGINAL_GLOBALS.document;
    global.location = ORIGINAL_GLOBALS.location;
    global.chrome = ORIGINAL_GLOBALS.chrome;
    global.MutationObserver = ORIGINAL_GLOBALS.mutationObserver;
  });

  test('fixture contains expected Shorts and regular content markers', () => {
    expect(document.querySelector('ytd-rich-shelf-renderer[is-shorts]')).toBeTruthy();
    expect(document.querySelector('[href*="/shorts/"]')).toBeTruthy();
    expect(document.querySelector('[href*="/watch?v="]')).toBeTruthy();
  });

  test('content script removes Shorts content from fixture and keeps regular videos', async () => {
    const regularVideosBefore = document.querySelectorAll('[href*="/watch?v="]').length;
    const shortsBefore = document.querySelectorAll('[href*="/shorts/"]').length;

    expect(shortsBefore).toBeGreaterThan(0);

    eval(contentScript);
    await waitForAsyncWork();
    await waitForAsyncWork();

    const shortsAfter = document.querySelectorAll('[href*="/shorts/"]').length;
    const regularVideosAfter = document.querySelectorAll('[href*="/watch?v="]').length;

    expect(shortsAfter).toBe(0);
    expect(regularVideosAfter).toBeGreaterThan(0);
    expect(regularVideosAfter).toBeLessThanOrEqual(regularVideosBefore);
    expect(storageData.totalBlockedCount).toBeGreaterThan(0);
  });

  test('injects blocking style and active class during initialization', async () => {
    eval(contentScript);
    await waitForAsyncWork();

    const styleElement = document.getElementById('longtube-blocking-styles');
    expect(styleElement).toBeTruthy();
    expect(styleElement.textContent).toContain('[href*="/shorts/"]');
    expect(document.documentElement.classList.contains('longtube-active')).toBe(true);
  });

  test('removes Shorts navigation and chip surfaces from fixture', async () => {
    const hadShortsNavigation = !!document.querySelector(
      '[aria-label*="Shorts"], [title="Shorts"]'
    );
    const hadShortsChip = Array.from(document.querySelectorAll('yt-chip-cloud-chip-renderer')).some(
      (chip) => chip.textContent?.trim().toLowerCase() === 'shorts'
    );

    eval(contentScript);
    await waitForAsyncWork();
    await waitForAsyncWork();

    if (hadShortsNavigation) {
      expect(document.querySelector('[aria-label*="Shorts"], [title="Shorts"]')).toBeNull();
    }

    if (hadShortsChip) {
      const remainingShortsChip = Array.from(
        document.querySelectorAll('yt-chip-cloud-chip-renderer')
      ).find((chip) => chip.textContent?.trim().toLowerCase() === 'shorts');
      expect(remainingShortsChip).toBeUndefined();
    }
  });
});
