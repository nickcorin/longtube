import { test, expect, describe } from 'bun:test';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Build Verification', () => {
  test('should have Chrome build', () => {
    const chromeBuildPath = join(__dirname, '../../build/chrome');
    expect(existsSync(chromeBuildPath)).toBe(true);

    const manifestPath = join(chromeBuildPath, 'manifest.json');
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('LongTube');
  });

  test('should have required files in Chrome build', () => {
    const chromeBuildPath = join(__dirname, '../../build/chrome');

    const requiredFiles = [
      'manifest.json',
      'src/content.js',
      'src/popup.html',
      'src/popup.js',
      'src/browser-compat.js',
      'assets/icon16.png',
      'assets/icon48.png',
      'assets/icon128.png',
    ];

    for (const file of requiredFiles) {
      const filePath = join(chromeBuildPath, file);
      expect(existsSync(filePath)).toBe(true);
    }
  });

  test('should have Firefox build', () => {
    const firefoxBuildPath = join(__dirname, '../../build/firefox');
    expect(existsSync(firefoxBuildPath)).toBe(true);

    const manifestPath = join(firefoxBuildPath, 'manifest.json');
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('LongTube');
  });
});
