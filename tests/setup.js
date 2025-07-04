/**
 * Test environment setup for the LongTube extension test suite.
 * This file configures a DOM environment using happy-dom and provides
 * mock implementations of browser APIs required for testing.
 */

import { Window } from 'happy-dom';

const window = new Window();
const document = window.document;

// Make DOM globals available in the test environment.
global.window = window;
global.document = document;
global.HTMLElement = window.HTMLElement;

// Provide a MutationObserver implementation if not available in happy-dom.
// This ensures tests can verify DOM observation functionality.
if (!window.MutationObserver) {
  class MutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.observing = false;
    }

    observe(target, options) {
      this.observing = true;
      this.target = target;
      this.options = options;

      // Simulate DOM observation by listening for DOM insertion events.
      // Callbacks are triggered asynchronously to mimic real browser behavior.
      if (target && target.addEventListener) {
        this._listener = () => {
          setTimeout(() => {
            if (this.observing && this.callback) {
              this.callback([{ type: 'childList', target }], this);
            }
          }, 0);
        };
        target.addEventListener('DOMNodeInserted', this._listener);
      }
    }

    disconnect() {
      this.observing = false;
      if (this.target && this._listener) {
        this.target.removeEventListener('DOMNodeInserted', this._listener);
      }
    }
  }

  global.MutationObserver = MutationObserver;
  window.MutationObserver = MutationObserver;
}

// Create a basic mock of the Chrome extension APIs used by LongTube.
// This allows tests to run without a real browser extension environment.
global.chrome = {
  storage: {
    local: {
      get: () => {},
      set: () => {},
    },
  },
  runtime: {
    onMessage: {
      addListener: () => {},
    },
  },
};
