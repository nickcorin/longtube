#!/usr/bin/env bun

import { existsSync, readFileSync, writeFileSync } from 'fs';

const bumpType = process.argv[2];
const allowed = new Set(['major', 'minor', 'patch', 'beta', 'rc']);

if (!allowed.has(bumpType)) {
  console.error('Usage: bun scripts/bump-version.js [major|minor|patch|beta|rc]');
  process.exit(1);
}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, data) => writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);

const manifest = readJson('manifest.json');
const currentVersion = manifest.version;
const [major, minor, patch] = currentVersion.split('.').map(Number);

const getPrereleaseVersion = (label) => {
  const tag = `-${label}.`;
  if (currentVersion.includes(tag)) {
    const currentNumber = Number.parseInt(currentVersion.split(tag)[1], 10) || 0;
    return `${major}.${minor}.${patch}-${label}.${currentNumber + 1}`;
  }
  return `${major}.${minor}.${patch + 1}-${label}.1`;
};

const nextVersion = (() => {
  if (bumpType === 'major') return `${major + 1}.0.0`;
  if (bumpType === 'minor') return `${major}.${minor + 1}.0`;
  if (bumpType === 'patch') return `${major}.${minor}.${patch + 1}`;
  if (bumpType === 'beta') return getPrereleaseVersion('beta');
  return getPrereleaseVersion('rc');
})();

const manifestVersion = nextVersion.split('-')[0];

manifest.version = manifestVersion;
writeJson('manifest.json', manifest);

const packageJson = readJson('package.json');
packageJson.version = nextVersion;
writeJson('package.json', packageJson);

if (existsSync('manifest-firefox.json')) {
  try {
    const firefoxManifest = readJson('manifest-firefox.json');
    firefoxManifest.version = manifestVersion;
    writeJson('manifest-firefox.json', firefoxManifest);
  } catch {
    // Ignore malformed or missing firefox manifest.
  }
}

console.log(`Version bumped: ${currentVersion} -> ${nextVersion}`);
