import { test, expect, describe, beforeEach } from 'bun:test';

/**
 * Integration tests for communication between the popup and content scripts.
 * These tests verify that messages are correctly passed between the extension's
 * components and that state changes are properly synchronized through Chrome storage.
 */

describe('Popup-Content Integration', () => {
  let messages = [];
  let storage = {};

  beforeEach(() => {
    // Reset the message queue and storage state before each test.
    messages = [];
    storage = { enabled: true };

    // Mock Chrome extension APIs for message passing and storage.
    global.chrome = {
      tabs: {
        query: (query, cb) => cb([{ id: 1, url: 'https://www.youtube.com' }]),
        sendMessage: (tabId, message) => messages.push(message),
        reload: (tabId, cb) => cb && cb(),
      },
      storage: {
        local: {
          get: (keys, cb) => cb(storage),
          set: (items, cb) => {
            Object.assign(storage, items);
            cb && cb();
          },
        },
      },
      runtime: {
        onMessage: {
          addListener: (listener) => {
            global.messageListener = listener;
          },
        },
      },
    };
  });

  test('should send toggle message from popup to content', () => {
    // Create a function that simulates the popup's toggle message sending.
    const sendToggleMessage = (enabled) => {
      chrome.tabs.query({ url: '*://*.youtube.com/*' }, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'toggleBlocking',
            enabled,
          });
        });
      });
    };

    // Trigger the toggle to disable blocking.
    sendToggleMessage(false);

    // Verify that the correct message was sent to the content script.
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({
      action: 'toggleBlocking',
      enabled: false,
    });
  });

  test('should handle toggle message in content script', () => {
    // Set up the content script's state and message handler.
    let contentEnabled = true;
    let reloaded = false;

    const handleMessage = (request) => {
      if (request.action === 'toggleBlocking') {
        contentEnabled = request.enabled;
        chrome.storage.local.set({ enabled: contentEnabled }, () => {
          reloaded = true;
        });
      }
    };

    // Simulate receiving a toggle message to disable blocking.
    handleMessage({ action: 'toggleBlocking', enabled: false });

    // Verify that the state was updated and a reload was triggered.
    expect(contentEnabled).toBe(false);
    expect(storage.enabled).toBe(false);
    expect(reloaded).toBe(true);
  });

  test('should sync storage between popup and content', () => {
    // Set up storage with extension state and blocked count.
    storage = {
      enabled: true,
      totalBlockedCount: 10,
    };

    // Simulate the popup reading data from storage.
    let popupData = {};
    chrome.storage.local.get(['enabled', 'totalBlockedCount'], (result) => {
      popupData = result;
    });

    // Verify that the popup receives the same data that was stored.
    expect(popupData.enabled).toBe(true);
    expect(popupData.totalBlockedCount).toBe(10);
  });

  test('should handle storage updates for counter', () => {
    // Create a function that updates the blocked count in storage.
    const updateBlockedCount = (count) => {
      chrome.storage.local.get(['totalBlockedCount'], (result) => {
        const newTotal = (result.totalBlockedCount || 0) + count;
        chrome.storage.local.set({ totalBlockedCount: newTotal });
      });
    };

    // Perform multiple counter updates to test accumulation.
    updateBlockedCount(5);
    updateBlockedCount(3);

    // Verify that the counts are properly accumulated in storage.
    expect(storage.totalBlockedCount).toBe(8);
  });
});
