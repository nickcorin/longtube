# AI Assistant Context for LongTube

This file provides essential context and instructions for AI coding assistants working on the LongTube browser extension.

## Project Context

LongTube is a Chrome/Firefox/Edge browser extension that blocks YouTube Shorts to combat attention fragmentation and digital addiction. It removes short-form content from YouTube's interface and redirects users away from Shorts URLs.

**Core Philosophy**: "Attention is all you need" - protecting users from algorithmic manipulation and dopamine-driven content.

## Architecture Overview

```
Extension Type: Browser Extension (Manifest V3)
Language: Vanilla JavaScript (ES6+)
Test Runner: Bun
Build System: Custom Bun script
Target Browsers: Chrome, Firefox, Edge
```

## Directory Structure

```
/src/           → Core extension code
  content.js    → Injected into YouTube pages, handles blocking
  popup.js      → Extension popup logic

/assets/        → Icons (16, 32, 48, 128, 256, 512px)
/tests/         → Test suite (unit + e2e)
/dist/          → Build output (generated)

Key files:
manifest.json   → Chrome extension configuration
popup.html      → Extension popup UI
build.js        → Multi-browser build script
```

## Code Conventions

### JavaScript Style
- Use ES6+ features (const/let, arrow functions, template literals)
- No semicolons required (Prettier handles)
- Single quotes for strings
- 100 character line limit
- Descriptive variable names (no abbreviations)

### Documentation
- JSDoc for all functions with @param and @returns
- Comments are complete sentences with proper grammar
- Explain WHY, not WHAT the code does

### Error Handling
- Always handle chrome.runtime.lastError
- Use try-catch for async operations
- Log errors with context for debugging

## Testing Requirements

```bash
# Run before ANY commit:
bun test                    # Unit tests
bun run lint               # ESLint check
bun run format:check       # Prettier check

# Full test suite:
bun run test:all           # All tests including e2e
bun run test:coverage      # Coverage report (must be >80%)
```

Test files: `*.test.js` in `/tests/unit/`
Use Happy-DOM for DOM testing, Puppeteer for e2e

## Common Operations

### Add new YouTube selector to block
1. Identify selector in browser DevTools
2. Add to appropriate property in `SELECTORS` object in `src/content.js`
3. Write test in `tests/unit/content.test.js`
4. Test manually on YouTube

### Update popup UI
1. Edit `popup.html` (uses inline styles)
2. Update `src/popup.js` for logic changes
3. Test in `tests/unit/popup.test.js`
4. Manually test by loading extension

### Build for distribution
```bash
bun run build              # Creates dist/*.zip for all browsers
bun run build:clean        # Clean build directories
```

### Create new test
1. Add test file in `/tests/unit/`
2. Import required modules and setup
3. Use describe/it blocks
4. Mock chrome APIs as needed

## Browser API Usage

### Storage API
- Use `chrome.storage.local` for persistence
- Keys: 'enabled', 'totalBlockedCount', 'sessionStartCount', 'theme'
- Always check chrome.runtime.lastError

### Message Passing
- Content ↔ Popup communication via chrome.runtime.sendMessage
- Message types: 'toggleBlocking', 'getStatus'

### Content Script Injection
- Runs at `document_start` for immediate blocking
- CSS injection for instant visual hiding
- MutationObserver for dynamic content

## Validation Checklist

Before submitting changes:
- [ ] Tests pass: `bun test`
- [ ] Linting passes: `bun run lint`
- [ ] Formatting correct: `bun run format:check`
- [ ] Manual testing on YouTube completed
- [ ] No console errors in extension or page console
- [ ] Build succeeds: `bun run build`

## Current Limitations

1. YouTube selectors may change - monitor for breakage
2. E2E tests require headful Chrome (not headless)
3. Firefox needs manifest adjustments (see build.js)
4. No Safari support without Xcode conversion

## Store Deployment Status

**Ready**: Chrome, Edge, Opera (Chromium-based)
**Needs work**: Firefox (manifest-firefox.json required)
**Not supported**: Safari (requires native app wrapper)

**Missing for store submission**:
- LICENSE file (MIT)
- Privacy Policy page
- Screenshots (1280x800)
- Store descriptions
- Browser compatibility layer for Firefox

## Important Context

- The 98.55% (68/69) Rick Roll redirect is intentional humor
- 20-second time calculation per Short is an estimate
- Dark mode detection uses CSS prefers-color-scheme
- Extension aims to be zero-configuration for users
- All blocking happens client-side, no external servers

## DO NOT

- Add external dependencies (keep it vanilla JS)
- Use animation/transitions (performance impact)
- Collect user data or add analytics
- Make network requests to external services
- Auto-update or modify YouTube's core functionality
- Create files unless explicitly needed