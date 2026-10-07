#!/bin/bash
# Build AGK OS Electron app for macOS.
# Run this on your Mac (iMac or MacBook Pro).
# Requires: Node.js 20+, git

set -e

echo "=== AGK OS Electron Build (macOS) ==="

# 1. Clone/update agk-sandbox
if [ ! -d "agk-sandbox" ]; then
  echo "Cloning agk-sandbox..."
  git clone https://github.com/agk4444/agk-sandbox.git
fi
cd agk-sandbox
git pull origin main

# 2. Clone agk-os into vendor/
ELECTRON_DIR="packages/sandbox-electron"
mkdir -p "$ELECTRON_DIR/vendor"
if [ ! -d "$ELECTRON_DIR/vendor/agk-os" ]; then
  echo "Cloning agk-os..."
  git clone https://github.com/agk4444/agk-os.git "$ELECTRON_DIR/vendor/agk-os"
else
  echo "Updating agk-os..."
  cd "$ELECTRON_DIR/vendor/agk-os"
  git pull origin main
  cd ../../..
fi

# 3. Build the Next.js web UI
echo "Building Next.js web UI (this takes a few minutes)..."
cd "$ELECTRON_DIR/vendor/agk-os/apps/web"
npm install
npm run build
cd ../../../..

# 4. Install Electron dependencies
echo "Installing Electron dependencies..."
cd "$ELECTRON_DIR"
npm install

# 5. Build the .dmg
echo "Building macOS app..."
npm run build

echo ""
echo "=== Done! ==="
echo "Find your app at: $ELECTRON_DIR/dist/AGK OS-*.dmg"
echo ""
echo "Note: The app is unsigned. On first launch, right-click → Open"
echo "to bypass the 'unidentified developer' warning."
