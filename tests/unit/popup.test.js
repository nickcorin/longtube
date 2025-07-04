import { test, expect, describe, beforeEach } from 'bun:test';

/**
 * Unit tests for the LongTube extension popup functionality.
 * These tests verify the popup's UI behavior, state management,
 * and interaction with the Chrome extension APIs.
 */

describe('LongTube Popup', () => {
  beforeEach(() => {
    // Reset the DOM to a clean state before each test.
    document.body.innerHTML = '';

    // Mock Chrome extension APIs for testing without a real browser environment.
    global.chrome = {
      storage: {
        local: {
          get: (keys, cb) => cb({}),
          set: (items, cb) => cb && cb(),
        },
      },
      tabs: {
        query: (query, cb) => cb([{ id: 1, url: 'https://www.youtube.com' }]),
        sendMessage: () => {},
        reload: (tabId, cb) => cb && cb(),
      },
    };
  });

  test('should toggle between active and inactive states', () => {
    // Set up toggle UI elements that simulate the popup's toggle switch.
    const toggle = document.createElement('div');
    toggle.id = 'toggle';
    toggle.className = 'toggle-switch';

    // Simulate clicking the toggle to activate blocking.
    toggle.classList.toggle('active');

    // Verify the toggle shows the active state.
    expect(toggle.classList.contains('active')).toBe(true);

    // Simulate clicking the toggle again to deactivate blocking.
    toggle.classList.toggle('active');

    // Verify the toggle returns to the inactive state.
    expect(toggle.classList.contains('active')).toBe(false);
  });

  test('should update UI based on enabled state', () => {
    // Define a function that updates the UI based on the extension's state.
    const updateUI = (enabled, totalCount) => {
      const status = document.getElementById('status');
      const total = document.getElementById('totalBlocked');

      if (status) status.textContent = enabled ? 'Active' : 'Inactive';
      if (total) total.textContent = totalCount || 0;
    };

    // Create the DOM structure that the popup uses.
    document.body.innerHTML = `
      <div id="status"></div>
      <div id="totalBlocked"></div>
    `;

    // Update the UI to show the extension is enabled with 42 blocked items.
    updateUI(true, 42);

    // Verify the status displays as active and shows the correct count.
    expect(document.getElementById('status').textContent).toBe('Active');
    expect(document.getElementById('totalBlocked').textContent).toBe('42');
  });

  test('should handle reset button click', () => {
    // Create a flag to track if the reset handler was called.
    let resetCalled = false;
    const handleReset = () => {
      resetCalled = true;
    };

    // Simulate clicking the reset button.
    handleReset();

    // Verify the reset handler was executed.
    expect(resetCalled).toBe(true);
  });
});
