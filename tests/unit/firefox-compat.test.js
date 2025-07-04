import { test, expect, describe } from 'bun:test';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Tests to ensure Firefox compatibility
 */
describe('Firefox Compatibility', () => {
  test('browser-compat.js should not contain ES6 export statements', () => {
    const compatPath = join(__dirname, '../../src/browser-compat.js');
    const content = readFileSync(compatPath, 'utf8');

    // Check that it doesn't contain ES6 module syntax
    expect(content).not.toContain('export default');
    expect(content).not.toContain('export {');
    expect(content).not.toContain('import ');

    // Verify it uses global assignment
    expect(content).toContain('window.browserCompat = compat');
  });

  test('content scripts should handle missing browserCompat gracefully', () => {
    const contentPath = join(__dirname, '../../src/content.js');
    const popupPath = join(__dirname, '../../src/popup.js');

    const contentScript = readFileSync(contentPath, 'utf8');
    const popupScript = readFileSync(popupPath, 'utf8');

    // Verify fallback pattern is used
    expect(contentScript).toContain('window.browserCompat ||');
    expect(popupScript).toContain('window.browserCompat ||');
  });

  test('manifest-firefox.json loads browser-compat.js before content.js', () => {
    const manifestPath = join(__dirname, '../../manifest-firefox.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

    const contentScripts = manifest.content_scripts[0].js;
    const compatIndex = contentScripts.indexOf('src/browser-compat.js');
    const contentIndex = contentScripts.indexOf('src/content.js');

    // browser-compat.js must be loaded before content.js
    expect(compatIndex).toBeGreaterThanOrEqual(0);
    expect(contentIndex).toBeGreaterThanOrEqual(0);
    expect(compatIndex).toBeLessThan(contentIndex);
  });
});
