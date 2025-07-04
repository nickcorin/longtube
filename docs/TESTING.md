# LongTube Testing Strategy

## Overview

LongTube uses a comprehensive testing approach that accommodates the different capabilities and limitations of Chrome and Firefox extension testing.

## Test Structure

```
tests/
├── unit/                    # Unit tests
│   ├── browser-compat.test.js
│   ├── content-script.test.js
│   ├── cross-browser.test.js
│   ├── firefox-compat.test.js
│   ├── firefox-integration.test.js
│   ├── popup.test.js
│   └── real-dom.test.js
├── e2e/                     # End-to-end tests
│   ├── chrome-extension.test.js
│   └── extension-loading.test.js
└── setup.js                 # Test environment setup
```

## Testing Approach

### Chrome Testing
- **Tool**: Puppeteer
- **Coverage**: Full E2E testing with real browser
- **Capabilities**: Extension loading, UI interaction, content blocking verification

### Firefox Testing
- **Tool**: Integration tests + Manual verification
- **Why**: Automated Firefox extension testing has severe limitations
- **Coverage**: API compatibility, manifest validation, manual smoke tests

## Running Tests

```bash
# All tests
bun test

# Unit tests only
bun test:unit

# E2E tests (Chrome)
bun test:e2e

# Firefox integration tests
bun test tests/unit/firefox-integration.test.js

# Manual Firefox testing
./scripts/test-firefox-extension.sh
```

## Key Test Categories

### 1. Unit Tests
- Browser API compatibility layer
- Individual function testing
- Cross-browser API normalization

### 2. Integration Tests
- Firefox environment simulation
- API interaction verification
- Manifest validation

### 3. E2E Tests (Chrome)
- Extension loading
- Content blocking
- UI functionality
- Storage persistence

### 4. Manual Tests (Firefox)
- Extension installation via `web-ext`
- Visual verification
- Functionality smoke tests

## Firefox Testing Limitations

Due to technical limitations with Firefox extension automation:

1. **No automated E2E testing** - Firefox doesn't properly support extension loading in Puppeteer/Playwright
2. **Integration tests instead** - We simulate Firefox environment to test compatibility
3. **Manual verification required** - Use `web-ext run` for actual Firefox testing

## CI/CD Strategy

### Automated (GitHub Actions)
- ✅ Unit tests (all browsers)
- ✅ Integration tests (Firefox compatibility)
- ✅ E2E tests (Chrome only)
- ✅ Linting and formatting

### Manual (Before release)
- ✅ Chrome: Automated tests cover this
- ⚠️ Firefox: Manual testing required
- ⚠️ Edge/Opera: Manual testing recommended

## Writing New Tests

### For Chrome Features
```javascript
test('should block new Shorts element', async () => {
  await page.goto('https://www.youtube.com');
  // Test implementation
});
```

### For Cross-Browser Features
```javascript
test('Firefox: API compatibility', () => {
  // Set up Firefox environment
  global.browser = { /* mock */ };
  // Test compatibility layer
});
```

## Best Practices

1. **Test both APIs** - Ensure features work with both `chrome.*` and `browser.*` APIs
2. **Mock appropriately** - Firefox tests should mock the `browser` global
3. **Verify manifest** - Ensure Firefox manifest has proper settings
4. **Document manual steps** - For features that require manual Firefox testing

## Manual Firefox Testing Checklist

Before each release:

- [ ] Run `./scripts/test-firefox-extension.sh`
- [ ] Verify extension loads without errors
- [ ] Check popup UI functionality
- [ ] Confirm Shorts are blocked on homepage
- [ ] Test redirect from Shorts URLs
- [ ] Verify storage persistence
- [ ] Check console for errors

## Known Issues

1. **Firefox Automation**: No reliable way to automate Firefox extension testing
2. **Manifest V3**: Some differences between Chrome and Firefox implementation
3. **Storage API**: Minor differences in callback vs Promise handling (handled by browser-compat.js)