#!/usr/bin/env bash
# Extracts the "Morgan's Builds" viewer recording into builds/src/ for builds.html.
#   ./builds/extract.sh path/to/recording.mp4
# The recording is 1920x1080 at a variable ~59.2 fps; it's resampled to a
# constant 60 fps so frame k is at (k-1)/60 s. Every item stays inside
# x 620-1300, y 295-875 of the full frame, so the 800x620 window at (560,280)
# holds them all and none of the viewer UI (tabs, description, view buttons).
# The crop is upscaled 2x (Lanczos + a light unsharp) before the page keys it;
# the page still works in 800x620 crop coordinates.
set -euo pipefail
in="${1:?usage: extract.sh recording.mp4}"
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$here/src"
ffmpeg -y -loglevel error -i "$in" -an -t 66.4 \
  -vf "fps=60,crop=800:620:560:280,scale=iw*2:ih*2:flags=lanczos,unsharp=5:5:0.5:5:5:0" \
  -q:v 1 "$here/src/v%04d.jpg"
echo "extracted $(ls "$here/src" | wc -l) frames to $here/src"
