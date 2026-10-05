#!/usr/bin/env bash
# Extracts every frame of the turntable render into glock/src/ for glock.html.
#   ./glock/extract.sh path/to/render.mp4
# The render is 1920x1440 @60fps. Frames are kept at that native size (the
# pages place them at a 1440x1080 logical size), so close-ups and strobe zooms
# draw from full-resolution pixels. 766 frames.
set -euo pipefail
in="${1:?usage: extract.sh render.mp4}"
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$here/src"
ffmpeg -y -loglevel error -i "$in" -an -q:v 1 "$here/src/s%04d.jpg"
echo "extracted $(ls "$here/src" | wc -l) frames to $here/src"
