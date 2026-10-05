#!/usr/bin/env bash
# Extracts every frame of the turntable render into glock/src/ for glock.html.
#   ./glock/extract.sh path/to/render.mp4
# The render is 1920x1440 @60fps; frames are fitted to 1080 tall (1440x1080)
# so the black surround merges with the stage. ~766 frames, ~80 MB.
set -euo pipefail
in="${1:?usage: extract.sh render.mp4}"
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$here/src"
ffmpeg -y -loglevel error -i "$in" -an -vf "scale=1440:1080:flags=lanczos" -q:v 2 "$here/src/s%04d.jpg"
echo "extracted $(ls "$here/src" | wc -l) frames to $here/src"
