#!/bin/bash
# Launch Photos Library Viewer
# Usage: ./launch.sh [path/to/library.photoslibrary]

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Build if dist doesn't exist or is stale
if [ ! -d "dist" ] || [ "src/App.jsx" -nt "dist/index.html" ]; then
  echo "Building..."
  npx vite build
fi

if [ -n "$1" ]; then
  npx electron . "$1"
else
  npx electron .
fi
