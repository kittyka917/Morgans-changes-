#!/usr/bin/env bash
# Extracts the BLOSSOM viewer recording into blossom/src/ for morgie.html.
#   ./blossom/extract.sh path/to/recording.mp4
# The recording is 1280x720 @60fps on a pure-black stage. The 720x520 window
# at (280,130) holds the gun at every angle and keeps out the viewer UI (title,
# view buttons, control hint), the browser chrome and the Windows taskbar.
set -euo pipefail
in="${1:?usage: extract.sh recording.mp4}"
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$here/src"
ffmpeg -y -loglevel error -i "$in" -an -vf "crop=720:520:280:130" -q:v 2 "$here/src/b%04d.jpg"
echo "extracted $(ls "$here/src" | wc -l) frames to $here/src"
