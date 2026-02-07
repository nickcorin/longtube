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

const setupPage = (html) => {
  const window = new Window();
  global.window = window;
  global.document = window.document;
  global.location = window.location;
  global.HTMLElement = window.HTMLElement;
  const MutationObserverImpl = window.MutationObserver || createMutationObserverFallback();
  global.MutationObserver = MutationObserverImpl;
  window.MutationObserver = MutationObserverImpl;

  document.documentElement.innerHTML = '<head></head><body></body>';
  document.body.innerHTML = html;

  const storageData = { enabled: true, totalBlockedCount: 0 };
  global.chrome = createChromeMock(storageData);
  delete window.browserCompat;

  return storageData;
};

describe('Chip Removal Logic', () => {
  beforeEach(() => {
    setupPage('');
  });

  afterEach(() => {
    global.window = ORIGINAL_GLOBALS.window;
    global.document = ORIGINAL_GLOBALS.document;
    global.location = ORIGINAL_GLOBALS.location;
    global.chrome = ORIGINAL_GLOBALS.chrome;
    global.MutationObserver = ORIGINAL_GLOBALS.mutationObserver;
  });

  test('removes Shorts chips and preserves other chips', async () => {
    setupPage(`
      <yt-chip-cloud-chip-renderer id="chip-shorts">
        <span>Shorts</span>
      </yt-chip-cloud-chip-renderer>
      <yt-chip-cloud-chip-renderer id="chip-music">
        <span>Music</span>
      </yt-chip-cloud-chip-renderer>
      <div class="ytChipShapeChip" id="chip-shorts-alt">shorts</div>
      <div class="ytChipShapeChip" id="chip-gaming">Gaming</div>
    `);

    eval(contentScript);
    await waitForAsyncWork();

    expect(document.getElementById('chip-shorts')).toBeNull();
    expect(document.getElementById('chip-shorts-alt')).toBeNull();
    expect(document.getElementById('chip-music')).toBeTruthy();
    expect(document.getElementById('chip-gaming')).toBeTruthy();
  });

  test('matches Shorts text case-insensitively and trims whitespace', async () => {
    setupPage(`
      <yt-chip-cloud-chip-renderer id="chip-upper">  SHORTS  </yt-chip-cloud-chip-renderer>
      <yt-chip-cloud-chip-renderer id="chip-mixed">ShoRtS</yt-chip-cloud-chip-renderer>
      <yt-chip-cloud-chip-renderer id="chip-nonshort">Short Videos</yt-chip-cloud-chip-renderer>
    `);

    eval(contentScript);
    await waitForAsyncWork();

    expect(document.getElementById('chip-upper')).toBeNull();
    expect(document.getElementById('chip-mixed')).toBeNull();
    expect(document.getElementById('chip-nonshort')).toBeTruthy();
  });

  test('removes nested Shorts chips from YouTube-like markup', async () => {
    setupPage(`
      <yt-chip-cloud-chip-renderer id="chip-nested">
        <yt-formatted-string>
          <span>Shorts</span>
        </yt-formatted-string>
      </yt-chip-cloud-chip-renderer>
      <yt-chip-cloud-chip-renderer id="chip-other">
        <yt-formatted-string>
          <span>Podcasts</span>
        </yt-formatted-string>
      </yt-chip-cloud-chip-renderer>
    `);

    eval(contentScript);
    await waitForAsyncWork();

    expect(document.getElementById('chip-nested')).toBeNull();
    expect(document.getElementById('chip-other')).toBeTruthy();
  });
});
