# MAINSTREET RP — promotional video

A 36-second 1080p/30 promo for the server, rendered from code. Everything here
is source: re-run the build and you get the MP4 back, byte-identical. There is
no video editor project to lose and no footage to re-license.

## What's in the cut

| Time | Section | On screen |
|---|---|---|
| 0:00 | Cold open | Signal-acquired line over the city grid |
| 0:02 | Badge | The MainStreet RP badge, chrome shine sweep |
| 0:06 | Hook | "It's not the city. It's who's in it." |
| 0:10 | §01 Make your name | Outfits, barber, live clothing previews |
| 0:14 | §02 Find your people | Party banners, crew chips, city-wide radio, chat |
| 0:18 | §03 What's on | AFL showcase, airdrops, the streets, event ticker |
| 0:22 | §04 Nobody gets left | AI medic on `F`, crutch + recovery, new death/respawn |
| 0:26 | Montage | HUD, hunger & thirst, loadscreen, interaction, custom weapons… |
| 0:30 | End card | Badge, "Come be part of it", Discord call-to-action |

The cut runs at 120 BPM with 2-second bars, and **every scene change lands on a
bar line**, so the music hits the cuts rather than drifting against them.

## Rendering it

```bash
cd promo
node build.js                 # 1080 frames -> frames/*.jpg  (~40s on 4 cores)
python3 score.py              # synthesises score.wav (36.0s)

# scored master
ffmpeg -y -framerate 30 -i frames/f%05d.jpg -i score.wav \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -shortest -movflags +faststart out/mainstreet-rp-promo.mp4

# silent master, for dropping a licensed track over the top
ffmpeg -y -framerate 30 -i frames/f%05d.jpg \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 \
  -movflags +faststart out/mainstreet-rp-promo-silent.mp4
```

Requires Node with `playwright` (Chromium) and `ffmpeg`. `build.js` serves the
folder over localhost rather than opening it as `file://` — the logo PNGs would
otherwise taint the canvas and block frame export.

## Editing it

- **Wording** — `CONFIG` at the top of `promo.html` holds the kicker, the hook
  lines and both call-to-action lines.
- **Running order / timing** — the `SCENES` table at the bottom. Keep `t0`/`t1`
  on 2-second boundaries or the cuts stop landing on the beat, and update
  `DURATION` plus the matching values in `score.py` if you change the length.
- **Colour** — the `C` object. The values are sampled straight off the badge:
  lime `#57ee11`, mid `#219b13`, deep `#1d5a17`, chrome `#e6e9e4`, black
  `#050c05`.
- **Montage words** — the `MONTAGE` array.
- **Crew names** — the `names` array in `sCrew`, currently placeholders.

Rendering is deterministic: `renderFrame(n)` depends only on `n`, never on the
wall clock or an unseeded random, so a re-render always matches.

## Swapping in gameplay footage

The piece is motion graphics by design — it ships without needing capture. To
cut real footage in, render the silent master and overlay clips against it:

```bash
ffmpeg -i mainstreet-rp-promo-silent.mp4 -i your-clip.mp4 -filter_complex \
  "[1:v]scale=1920:1080,trim=0:4,setpts=PTS-STARTPTS+18/TB[c];[0:v][c]overlay=enable='between(t,18,22)'" \
  -c:a copy out.mp4
```

The §03 "what's on" block at 0:18 and the montage at 0:26 are the natural
places for B-roll.

## A note on the music

`score.py` synthesises the bed from scratch — drone, kick, sub, hats, an A-minor
arpeggio, risers and an impact on each cut — so there is no licensing attached
to it and it can go on YouTube or TikTok without a claim. It is deliberately
plain. If you want a real track, use the silent master instead; the cuts are on
a 120 BPM grid, so anything at 120 (or 60) BPM will line up without stretching.

## Accuracy

Every feature named in the video comes from `../MORGAN-SYSTEMS.md`. Nothing
invented: no player counts, no uptime claims, no server IP, no Discord handle.
The call-to-action deliberately says "connect details in Discord" rather than
printing an invite that could go stale — put the real invite in the post body,
or add it to `CONFIG.ctaSmall` and re-render.
