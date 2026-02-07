#!/usr/bin/env bun

import { mkdir, rm, copyFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { $ } from 'bun';

const BUILD_DIR = 'build';
const DIST_DIR = 'dist';
const BROWSERS = ['chrome', 'firefox'];

const FILES = [
  'src/popup.html',
  'src/popup.css',
  'src/content.js',
  'src/popup.js',
  'src/browser-compat.js',
  'assets/icon16.png',
  'assets/icon32.png',
  'assets/icon48.png',
  'assets/icon128.png',
];

const MANIFESTS = {
  chrome: 'manifest.json',
  firefox: 'manifest-firefox.json',
};

const clean = async () => {
  for (const dir of [DIST_DIR, BUILD_DIR]) {
    if (existsSync(dir)) {
      await rm(dir, { recursive: true, force: true });
    }
  }
};

const buildBrowser = async (browser) => {
  const targetDir = join(BUILD_DIR, browser);
  await Promise.all([
    mkdir(join(targetDir, 'src'), { recursive: true }),
    mkdir(join(targetDir, 'assets'), { recursive: true }),
    mkdir(DIST_DIR, { recursive: true }),
  ]);

  await Promise.all(FILES.map((file) => copyFile(file, join(targetDir, file))));

  const manifestSource =
    browser === 'firefox' && !existsSync(MANIFESTS.firefox) ? MANIFESTS.chrome : MANIFESTS[browser];
  if (browser === 'firefox' && manifestSource === MANIFESTS.chrome) {
    console.log('Warning: manifest-firefox.json not found, using manifest.json');
  }
  await copyFile(manifestSource, join(targetDir, 'manifest.json'));

  const zipFile = join(DIST_DIR, `${browser}.zip`);
  await $`cd ${targetDir} && zip -qr ../../${zipFile} .`;
};

const printSummary = async () => {
  console.log('Build Summary');
  for (const file of await readdir(DIST_DIR)) {
    const bytes = (await Bun.file(join(DIST_DIR, file)).stat()).size;
    console.log(`  ${file}: ${(bytes / 1024).toFixed(2)} KB`);
  }
};

const build = async () => {
  console.log('Building LongTube...');
  await clean();
  await Promise.all(BROWSERS.map(buildBrowser));
  await printSummary();
  console.log(`Done. Files in ${DIST_DIR}/`);
};

const dev = async () => {
  console.log('Watching src/ for changes...');
  Bun.watch('./src', () => {
    console.log('Source changed. Reload extension in your browser.');
  });
  await new Promise(() => {});
};

const main = async () => {
  const command = process.argv[2];
  if (command === 'clean') {
    await clean();
    return;
  }
  if (command === 'dev') {
    await dev();
    return;
  }
  await build();
};

main().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
