#!/usr/bin/env bash
# Extracts the viewer screen recording into medal/src/ for morgie.html.
#   ./medal/extract.sh path/to/recording.mp4
# The recording is 1280x720 @60fps. y 40..680 is kept, which drops the
# viewer's "Before | Now | Spin" toggle (top) and its control hint (bottom).
# The crop is then upscaled 2x (Lanczos + a light unsharp) so the page keys
# and places finer pixels than a canvas stretch of 720p would give; the page
# still works in 1280x640 crop coordinates.
set -euo pipefail
in="${1:?usage: extract.sh recording.mp4}"
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$here/src"
ffmpeg -y -loglevel error -i "$in" -an -vf "crop=1280:640:0:40,scale=iw*2:ih*2:flags=lanczos,unsharp=5:5:0.5:5:5:0" -q:v 1 "$here/src/m%04d.jpg"
echo "extracted $(ls "$here/src" | wc -l) frames to $here/src"
