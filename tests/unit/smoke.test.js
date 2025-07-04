import { test, expect } from 'bun:test';

/**
 * Smoke tests for the LongTube extension test suite.
 * These basic tests verify that the test environment is properly configured
 * and that essential dependencies are available.
 */

test('smoke test - bun is working', () => {
  expect(1 + 1).toBe(2);
});

test('DOM is available', () => {
  // Verify that the DOM environment is available for testing.
  document.body.innerHTML = '<div id="test">Hello</div>';
  const element = document.getElementById('test');
  expect(element.textContent).toBe('Hello');
});

test('chrome mock is available', () => {
  // Verify that Chrome extension API mocks are properly configured.
  expect(global.chrome).toBeDefined();
  expect(global.chrome.storage).toBeDefined();
});
