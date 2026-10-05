#!/usr/bin/env bash
# Extracts the BLOSSOM viewer recording into blossom/src/ for morgie.html.
#   ./blossom/extract.sh path/to/recording.mp4
# The recording is 1280x720 @60fps on a pure-black stage. The 720x520 window
# at (280,130) holds the gun at every angle and keeps out the viewer UI (title,
# view buttons, control hint), the browser chrome and the Windows taskbar.
# The crop is then upscaled 2x (Lanczos + a light unsharp); the page still
# works in 720x520 crop coordinates.
set -euo pipefail
in="${1:?usage: extract.sh recording.mp4}"
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$here/src"
ffmpeg -y -loglevel error -i "$in" -an -vf "crop=720:520:280:130,scale=iw*2:ih*2:flags=lanczos,unsharp=5:5:0.5:5:5:0" -q:v 1 "$here/src/b%04d.jpg"
echo "extracted $(ls "$here/src" | wc -l) frames to $here/src"
