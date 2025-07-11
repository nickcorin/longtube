#!/usr/bin/env bun
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const bumpType = process.argv[2];

if (!['major', 'minor', 'patch', 'beta', 'rc'].includes(bumpType)) {
  console.error('Usage: bun run bump-version.js [major|minor|patch|beta|rc]');
  process.exit(1);
}

// Read current version from manifest.json
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const currentVersion = manifest.version;

// Parse version
const [major, minor, patch] = currentVersion.split('.').map(Number);
let newVersion;

switch (bumpType) {
  case 'major':
    newVersion = `${major + 1}.0.0`;
    break;
  case 'minor':
    newVersion = `${major}.${minor + 1}.0`;
    break;
  case 'patch':
    newVersion = `${major}.${minor}.${patch + 1}`;
    break;
  case 'beta':
    // Check if already in beta
    if (currentVersion.includes('-beta')) {
      const betaNum = parseInt(currentVersion.split('-beta.')[1]) + 1;
      newVersion = `${major}.${minor}.${patch}-beta.${betaNum}`;
    } else {
      newVersion = `${major}.${minor}.${patch + 1}-beta.1`;
    }
    break;
  case 'rc':
    // Check if already in rc
    if (currentVersion.includes('-rc')) {
      const rcNum = parseInt(currentVersion.split('-rc.')[1]) + 1;
      newVersion = `${major}.${minor}.${patch}-rc.${rcNum}`;
    } else {
      newVersion = `${major}.${minor}.${patch + 1}-rc.1`;
    }
    break;
}

// Update manifest.json
manifest.version = newVersion.split('-')[0]; // Chrome doesn't support pre-release suffixes
writeFileSync('manifest.json', JSON.stringify(manifest, null, 2) + '\n');

// Update package.json
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
packageJson.version = newVersion;
writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');

// Update Firefox manifest if it exists
try {
  const firefoxManifest = JSON.parse(readFileSync('manifest-firefox.json', 'utf8'));
  firefoxManifest.version = newVersion.split('-')[0];
  writeFileSync('manifest-firefox.json', JSON.stringify(firefoxManifest, null, 2) + '\n');
} catch (e) {
  // Firefox manifest might not exist
}

console.log(`✨ Version bumped: ${currentVersion} → ${newVersion}`);
console.log('\nNext steps:');
console.log(`1. Review changes: git diff`);
console.log(`2. Commit: git add -A && git commit -m "chore: bump version to ${newVersion}"`);
console.log(`3. Tag: git tag -a v${newVersion} -m "Release v${newVersion}"`);
console.log(`4. Push: git push && git push origin v${newVersion}`);