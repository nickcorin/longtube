#!/bin/bash

# Build script for creating browser-specific extension packages

echo "Building LongTube extensions for multiple browsers..."

# Create build directory
mkdir -p builds

# Common files to exclude
EXCLUDE_PATTERNS=(
  ".*"
  "__MACOSX"
  "node_modules/*"
  "coverage/*"
  "tests/*"
  "e2e/*"
  "*.md"
  "manifest-*.json"
  "build-extensions.sh"
  "builds/*"
  "*.lock"
  "*.config.js"
  "*.html"
)

# Build exclude string for zip
EXCLUDE_STRING=""
for pattern in "${EXCLUDE_PATTERNS[@]}"; do
  EXCLUDE_STRING="$EXCLUDE_STRING -x \"$pattern\""
done

# Chrome/Edge/Opera version (uses standard manifest.json)
echo "Building Chrome/Edge/Opera version..."
eval "zip -r builds/longtube-chromium.zip . $EXCLUDE_STRING"

# Firefox version
echo "Building Firefox version..."
# Temporarily replace manifest
cp manifest.json manifest-chrome-temp.json
cp manifest-firefox.json manifest.json

eval "zip -r builds/longtube-firefox.zip . $EXCLUDE_STRING"

# Restore original manifest
mv manifest-chrome-temp.json manifest.json

# Safari preparation
echo ""
echo "Safari Web Extension:"
echo "To build for Safari, run the following command in Terminal:"
echo ""
echo "xcrun safari-web-extension-converter . \\"
echo "  --app-name \"LongTube\" \\"
echo "  --bundle-identifier \"com.yourdomain.longtube\" \\"
echo "  --swift"
echo ""
echo "This will create an Xcode project that you can build and submit to the App Store."

# Summary
echo ""
echo "Build complete! Extension packages created in ./builds/"
echo ""
echo "Files created:"
echo "- builds/longtube-chromium.zip (for Chrome Web Store, Edge Add-ons, Opera Add-ons)"
echo "- builds/longtube-firefox.zip (for Firefox Add-ons)"
echo ""
echo "Next steps:"
echo "1. Test each package in its respective browser"
echo "2. Create store listings with screenshots and descriptions"
echo "3. Submit to each store following their guidelines"

# Make script executable
chmod +x build-extensions.sh