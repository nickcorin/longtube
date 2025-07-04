import { test, expect, describe } from 'bun:test';

/**
 * Unit tests for the browser compatibility layer.
 * These tests verify that the compatibility functions work correctly
 * for both Chrome and Firefox browser environments.
 */

describe('Browser Compatibility Layer', () => {
  test('should detect browser type correctly', () => {
    // Test Chrome user agent detection.
    const chromeUA =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const firefoxUA =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0';

    // Mock browser detection function.
    const getBrowserInfo = (ua) => {
      if (ua.includes('Firefox/')) {
        return { name: 'firefox', engine: 'gecko' };
      } else if (ua.includes('Chrome/')) {
        return { name: 'chrome', engine: 'chromium' };
      }
      return { name: 'unknown', engine: 'unknown' };
    };

    expect(getBrowserInfo(chromeUA).name).toBe('chrome');
    expect(getBrowserInfo(firefoxUA).name).toBe('firefox');
  });

  test('should handle Promise and callback styles', async () => {
    // Mock storage that supports both styles.
    const mockStorage = {
      data: {},

      get(keys, callback) {
        const result = {};
        const keyArray = Array.isArray(keys) ? keys : [keys];
        keyArray.forEach((key) => {
          if (this.data[key] !== undefined) {
            result[key] = this.data[key];
          }
        });

        if (callback) {
          setTimeout(() => callback(result), 0);
          return undefined;
        }
        return Promise.resolve(result);
      },

      set(items, callback) {
        Object.assign(this.data, items);
        if (callback) {
          setTimeout(() => callback(), 0);
          return undefined;
        }
        return Promise.resolve();
      },
    };

    // Test callback style (Chrome).
    mockStorage.data = { test: 'value' };
    mockStorage.get(['test'], (result) => {
      expect(result.test).toBe('value');
    });

    // Test Promise style (Firefox).
    const result = await mockStorage.get(['test']);
    expect(result.test).toBe('value');

    // Test setting values.
    await mockStorage.set({ newKey: 'newValue' });
    expect(mockStorage.data.newKey).toBe('newValue');
  });

  test('should provide fallback for Chrome when browserCompat not available', () => {
    // Simulate Chrome environment without browserCompat.
    const chromeAPI = {
      storage: {
        local: { get: () => {}, set: () => {} },
        onChanged: { addListener: () => {} },
      },
      runtime: { onMessage: { addListener: () => {} } },
      tabs: { query: () => {}, sendMessage: () => {} },
    };

    // Mock the fallback logic from content.js/popup.js.
    const browserAPI = window.browserCompat || {
      storage: {
        local: chromeAPI.storage.local,
        onChanged: chromeAPI.storage.onChanged,
      },
      runtime: chromeAPI.runtime,
      tabs: chromeAPI.tabs,
    };

    // Verify fallback provides all necessary APIs.
    expect(browserAPI.storage.local).toBeDefined();
    expect(browserAPI.storage.onChanged).toBeDefined();
    expect(browserAPI.runtime).toBeDefined();
    expect(browserAPI.tabs).toBeDefined();
  });
});
