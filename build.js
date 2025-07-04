#!/usr/bin/env bun

import { mkdir, rm, copyFile, readdir } from 'fs/promises';
import { join } from 'path';
import { $ } from 'bun';
import { existsSync } from 'fs';

const BROWSERS = ['chrome', 'firefox', 'edge'];
const DIST_DIR = 'dist';
const BUILD_DIR = 'build';

// Files to copy for all browsers
const COMMON_FILES = ['popup.html', 'src/content.js', 'src/popup.js'];

// Asset files
const ASSET_FILES = [
  'assets/icon16.png',
  'assets/icon32.png',
  'assets/icon48.png',
  'assets/icon128.png',
];

async function clean() {
  console.log('🧹 Cleaning build directories...');
  if (existsSync(DIST_DIR)) {
    await rm(DIST_DIR, { recursive: true });
  }
  if (existsSync(BUILD_DIR)) {
    await rm(BUILD_DIR, { recursive: true });
  }
}

async function copyFiles(browser) {
  const targetDir = join(BUILD_DIR, browser);
  await mkdir(targetDir, { recursive: true });
  await mkdir(join(targetDir, 'src'), { recursive: true });
  await mkdir(join(targetDir, 'assets'), { recursive: true });

  // Copy common files
  for (const file of COMMON_FILES) {
    await copyFile(file, join(targetDir, file));
  }

  // Copy assets
  for (const file of ASSET_FILES) {
    await copyFile(file, join(targetDir, file));
  }

  // Copy appropriate manifest
  const manifestFile = browser === 'firefox' ? 'manifest-firefox.json' : 'manifest.json';
  if (browser === 'firefox' && !existsSync(manifestFile)) {
    console.log('⚠️  Warning: manifest-firefox.json not found, using standard manifest.json');
    await copyFile('manifest.json', join(targetDir, 'manifest.json'));
  } else {
    await copyFile(manifestFile, join(targetDir, 'manifest.json'));
  }
}

async function createZip(browser) {
  const sourceDir = join(BUILD_DIR, browser);
  const zipFile = join(DIST_DIR, `${browser}.zip`);

  await mkdir(DIST_DIR, { recursive: true });

  console.log(`📦 Creating ${browser}.zip...`);
  await $`cd ${sourceDir} && zip -r ../../${zipFile} .`;
}

async function build() {
  console.log('🚀 Building LongTube for all browsers...\n');

  await clean();

  for (const browser of BROWSERS) {
    console.log(`🔧 Building for ${browser}...`);
    await copyFiles(browser);
    await createZip(browser);
    console.log(`✅ ${browser} build complete!\n`);
  }

  console.log('📊 Build Summary:');
  console.log('━━━━━━━━━━━━━━━━');
  const files = await readdir(DIST_DIR);
  for (const file of files) {
    const stats = await Bun.file(join(DIST_DIR, file)).stat();
    console.log(`  ${file}: ${(stats.size / 1024).toFixed(2)} KB`);
  }

  console.log('\n✨ All builds complete!');
  console.log(`📁 Distribution files in: ${DIST_DIR}/`);
}

async function dev() {
  console.log('👀 Development mode - watching for changes...');
  console.log('Load the extension from the project root directory');
  console.log('Press Ctrl+C to stop\n');

  // Simple file watcher for development
  const watcher = Bun.watch('./src', () => {
    console.log('📝 Files changed, reload the extension in your browser');
  });
}

// Parse command line arguments
const command = process.argv[2];

switch (command) {
  case 'dev':
    await dev();
    break;
  case 'clean':
    await clean();
    console.log('✅ Clean complete!');
    break;
  default:
    await build();
    break;
}
