# Morgan's Builds — showcase

`builds.html`: a 34.95 s, 1080p/60 showcase of everything in the "Morgan's
Builds" viewer, cut to the same song as Morgie's Gun Showcase
(`music/song.mp3`, beat grid in `BEAT0` / `BEAT`).

| Time | Bars | Shot |
|---|---|---|
| 0:00 | intro | Strobed close-ups of the four customs on the song's first four beats |
| 0:03.1 | 1–6 | The city guns, one per bar: Glock 19, Glock, Camo Glock, Black/Red Glock, Pabs FN, Compact Rifle |
| 0:13.4 | 7 | The song's break: the customs flicker in on quickening beats |
| 0:15.1 | 8–15 | **The drop:** a ring of petals opens on Ja$mine, then Ja$mine AR, MORG, Pyjama G3 — two bars each, spinning into a side-on hold with callouts |
| 0:28.8 | 16 | The fit: COCO shirt |
| 0:30.5 | 17 | The line-up: all ten guns |
| 0:32.2 | 18– | End card, fades out with the song |

Every name, subtitle, code (`WEAPON_GLOCK19`, `msrp_compactrifle_skin`, …) and
callout is the viewer's own wording. Callouts only point at features the
viewer's description names and that are visible on the hold frame.

**Hello Kitty MK2 is left out:** selecting it in the viewer shows MORG's model
(its description says "not installed yet"), so it would be the same gun twice.

## The recording

- 68.4 s, 1920×1080, variable ~59.2 fps. `extract.sh` resamples to a constant
  60 fps, crops the 800×620 window at (560,280) — every item stays inside
  x 620–1300, y 295–875 — and upscales 2× (Lanczos + light unsharp). 3,984 frames.
- The viewer centres every item at crop (399,291) and spins it about one turn
  per 300 frames. Hold frames are each item's widest outline (most side-on):
  Ja$mine 161, Ja$mine AR 470, MORG 783, Glock 19 1112, Glock 1442,
  Camo Glock 1764, Pabs FN 2094, Compact Rifle 2459, Black/Red Glock 2796,
  Pyjama G3 3464, COCO shirt 3827.
- Pure black stage: keyed on the brightest channel with a low ramp (3–18) so
  black guns keep their body, plus a pink rim from each item's alpha.
- Per-item looks: white builds are pulled down (`brightness(0.86)`, Pyjama G3
  `0.74`) so they don't clip; the Compact Rifle keeps its brown woodgrain.

## Build

```bash
./builds/extract.sh path/to/recording.mp4               # once
PAGE=builds.html OUTDIR=bframes FMT=png node build.js   # 2097 PNG frames
# music/song_master.wav: the song mastered as in music/README.md
# two-pass H.264 at 6.4 Mbps keeps the 1080p60 file under 30 MB
ffmpeg -y -framerate 60 -i bframes/f%05d.png -c:v libx264 -preset slower -b:v 6400k \
  -maxrate 9000k -bufsize 12000k -profile:v high -pix_fmt yuv420p -r 60 -g 120 \
  -pass 1 -an -f mp4 /dev/null
ffmpeg -y -framerate 60 -i bframes/f%05d.png -i music/song_master.wav -c:v libx264 \
  -preset slower -b:v 6400k -maxrate 9000k -bufsize 12000k -profile:v high \
  -pix_fmt yuv420p -r 60 -g 120 -pass 2 -c:a aac -b:a 256k -ar 48000 -ac 2 \
  -af apad -t 34.95 -movflags +faststart morgans-builds.mp4
```

## The full showcase (`showcase.html`)

Every gun from Morgie's Gun Showcase and Morgan's Builds in **one cut**, on
`music/song3.m4a` (43.95 s; grid, drops and master in `music/README.md`), with
one running count, 01–13, across both sources. Each 808 drop lands a moment:

| Time | Song | Shot |
|---|---|---|
| 0:00 | intro | Title card; strobes of the customs on the "yeah" and the hits after it |
| 0:04.97 | intro, 2nd phrase | 01–04 **the Glock wall**: a panel lands on each hit, all spinning live |
| 0:07.37 | intro | 05–06 Pabs FN \| Compact Rifle on a diagonal split (pushes in) |
| 0:09.59 | vocal pickup | The pink builds flicker in on the words "stay with Vegas on the way" |
| **0:11.23** | **drop 1** | **07 Ja$mine** opens in a petal ring |
| 0:12.95 | quiet bar | 08 Cash Wrap's hero spin (pushes in) |
| **0:16.01** | **drop 2** | The wipe swaps it to **09 Pink Slide** on the matched pose; it spins and settles |
| 0:19.07 | quiet bar | 10 Black Slide and its callouts |
| **0:22.12** | **drop 3** | The iris opens on **11 BLOSSOM** |
| 0:25.18 | quiet bar | The four finishes side by side (pushes in) |
| **0:28.24** | **drop 4, the verse** | **12–13 Ja$mine AR and Pyjama G3** share a frame |
| 0:31.30 | quiet bar | The fit (pushes in) |
| 0:32.83 | quiet bar | Everything flickers in on the hits |
| **0:34.22** | **drop 5** | **The line-up slams in**: all 13 guns and the fit, flash, petals, camera jolt |
| 0:38.94 | outro | End card, fades out with the song |

MORG is the same gun as finish 03, so it appears once, as Black Slide.
`showcase.html` is assembled from the engine and scenes of `morgie.html` and
`builds.html` plus its own timeline at the end of the file.
