#!/usr/bin/env bun

/**
 * Build script for the LongTube browser extension.
 * Handles building, packaging, and development tasks for Chrome and Firefox.
 */

import { mkdir, rm, copyFile, readdir } from 'fs/promises';
import { join } from 'path';
import { $ } from 'bun';
import { existsSync } from 'fs';

// Build configuration constants.
const BROWSERS = ['chrome', 'firefox'];
const DIST_DIR = 'dist';
const BUILD_DIR = 'build';

// Source file mappings for the build process.
const FILE_MAPPINGS = {
  common: ['src/popup.html', 'src/content.js', 'src/popup.js'],
  assets: ['assets/icon16.png', 'assets/icon32.png', 'assets/icon48.png', 'assets/icon128.png'],
  manifest: {
    chrome: 'manifest.json',
    firefox: 'manifest-firefox.json',
  },
};

// Firefox-specific files that need additional processing.
const FIREFOX_SPECIFIC_FILES = ['src/browser-compat.js'];

/**
 * Removes existing build and distribution directories.
 */
const clean = async () => {
  console.log('🧹 Cleaning build directories...');

  const directories = [DIST_DIR, BUILD_DIR];
  await Promise.all(directories.map((dir) => existsSync(dir) && rm(dir, { recursive: true })));
};

/**
 * Creates the directory structure for a browser build.
 * @param {string} browser - The target browser name.
 * @returns {string} The path to the created directory.
 */
const createBuildStructure = async (browser) => {
  const targetDir = join(BUILD_DIR, browser);
  const subdirs = ['src', 'assets'];

  await mkdir(targetDir, { recursive: true });
  await Promise.all(subdirs.map((subdir) => mkdir(join(targetDir, subdir), { recursive: true })));

  return targetDir;
};

/**
 * Copies extension files to the browser-specific build directory.
 * @param {string} browser - The target browser name.
 * @param {string} targetDir - The destination directory path.
 */
const copyExtensionFiles = async (browser, targetDir) => {
  // Copy common files to all browsers.
  const commonCopyTasks = FILE_MAPPINGS.common.map((file) => copyFile(file, join(targetDir, file)));

  // Copy asset files.
  const assetCopyTasks = FILE_MAPPINGS.assets.map((file) => copyFile(file, join(targetDir, file)));

  // Copy Firefox-specific files if needed.
  const firefoxTasks =
    browser === 'firefox'
      ? FIREFOX_SPECIFIC_FILES.map((file) => copyFile(file, join(targetDir, file)))
      : [];

  await Promise.all([...commonCopyTasks, ...assetCopyTasks, ...firefoxTasks]);

  // Copy the appropriate manifest file.
  const manifestSource = FILE_MAPPINGS.manifest[browser];
  const manifestExists = existsSync(manifestSource);

  if (!manifestExists && browser === 'firefox') {
    console.log('⚠️  Warning: manifest-firefox.json not found, using standard manifest.json');
    await copyFile(FILE_MAPPINGS.manifest.chrome, join(targetDir, 'manifest.json'));
  } else {
    await copyFile(manifestSource, join(targetDir, 'manifest.json'));
  }
};

/**
 * Creates a zip archive of the browser build.
 * @param {string} browser - The target browser name.
 */
const createDistributionArchive = async (browser) => {
  const sourceDir = join(BUILD_DIR, browser);
  const zipFile = join(DIST_DIR, `${browser}.zip`);

  await mkdir(DIST_DIR, { recursive: true });

  console.log(`📦 Creating ${browser}.zip...`);
  await $`cd ${sourceDir} && zip -qr ../../${zipFile} .`;
};

/**
 * Builds the extension for a specific browser.
 * @param {string} browser - The target browser name.
 */
const buildForBrowser = async (browser) => {
  console.log(`🔧 Building for ${browser}...`);

  const targetDir = await createBuildStructure(browser);
  await copyExtensionFiles(browser, targetDir);
  await createDistributionArchive(browser);

  console.log(`✅ ${browser} build complete!\n`);
};

/**
 * Displays a summary of the built distribution files.
 */
const displayBuildSummary = async () => {
  console.log('📊 Build Summary:');
  console.log('━━━━━━━━━━━━━━━━');

  const files = await readdir(DIST_DIR);
  const fileSizes = await Promise.all(
    files.map(async (file) => {
      const stats = await Bun.file(join(DIST_DIR, file)).stat();
      return { name: file, size: (stats.size / 1024).toFixed(2) };
    })
  );

  fileSizes.forEach(({ name, size }) => {
    console.log(`  ${name}: ${size} KB`);
  });

  console.log('\n✨ All builds complete!');
  console.log(`📁 Distribution files in: ${DIST_DIR}/`);
};

/**
 * Main build process that creates distributions for all browsers.
 */
const build = async () => {
  console.log('🚀 Building LongTube for all browsers...\n');

  await clean();

  // Build for all browsers in parallel.
  await Promise.all(BROWSERS.map(buildForBrowser));

  await displayBuildSummary();
};

/**
 * Development mode that watches for file changes.
 */
const dev = async () => {
  console.log('👀 Development mode - watching for changes...');
  console.log('Load the extension from the project root directory');
  console.log('Press Ctrl+C to stop\n');

  // Watch for changes in the source directory.
  Bun.watch('./src', () => {
    console.log('📝 Files changed, reload the extension in your browser');
  });

  // Keep the process running.
  await new Promise(() => {});
};

// Main execution based on command line arguments.
const main = async () => {
  const command = process.argv[2];

  const commands = {
    dev,
    clean: async () => {
      await clean();
      console.log('✅ Clean complete!');
    },
    default: build,
  };

  const handler = commands[command] || commands.default;
  await handler();
};

main().catch((error) => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});
