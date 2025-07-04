#!/bin/bash

# Script to test if the Firefox extension loads properly using web-ext

cd "$(dirname "$0")/.."

echo "Building extension..."
bun run build

# Create profile directory if it doesn't exist
mkdir -p ./test-profile-firefox-manual

echo "Running Firefox with extension..."
npx web-ext run \
  --source-dir ./build/firefox \
  --start-url https://www.youtube.com \
  --verbose