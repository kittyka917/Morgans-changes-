# Morgie's Gun Showcase

The personal-project version of the Glock showcase: 34 seconds, 1080p/30, all
MainStreet branding removed, and two more finishes added from viewer screen
recordings — finish 03 (black slide, this folder) and finish 04 (BLOSSOM,
`blossom/`). `glock.html` (the MainStreet version) is untouched; this is
`morgie.html`.

| Time | Shot |
|---|---|
| 0:00–0:16 | As the original: strobed open, finish 01, details, wipe to finish 02, finish 02 details |
| 0:16 | Camera pulls back; a scan line wipes finish 02 into **finish 03**; drop at 0:17 |
| 0:18 | Finish 03 glides into a side-on hold; four callouts |
| 0:22 | An iris of petals opens finish 03 onto **finish 04, BLOSSOM**; drop at 0:23 |
| 0:24 | BLOSSOM does one full turn |
| 0:26 | Settles side-on; five callouts |
| 0:30 | All four finishes side by side |
| 0:32 | End card: MORGIE'S GUN SHOWCASE |

Finish titles are descriptive — `CASH WRAP`, `PINK SLIDE`, `BLACK SLIDE`,
and `BLOSSOM` (the name the viewer gives finish 04) —
since finishes 02 and 03 both carry MORGAN on the slide. The brand strings are
`BRAND` / `BRAND_SUB` at the top of the new block in `morgie.html`.

## Build

```bash
./glock/extract.sh path/to/render.mp4          # finishes 01 and 02 (once)
./medal/extract.sh path/to/recording.mp4       # finish 03 (once)
./blossom/extract.sh path/to/blossom.mp4       # finish 04 (once)
PAGE=morgie.html OUTDIR=mframes node build.js  # 1020 frames
python3 score_morgie.py                        # score_morgie.wav
ffmpeg -y -framerate 30 -i mframes/f%05d.jpg -i score_morgie.wav \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -r 30 \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -shortest -movflags +faststart morgies-gun-showcase.mp4
```

## The recording

- **Viewer UI** ("Before | Now | Spin" at the top, a control hint at the
  bottom) is cropped off by `extract.sh`.
- **Finish swap** in the recording is m0105 → m0106 (1.75s) — the viewer's
  Before → Now toggle. Only m0106–m0403 (finish 03) is used.
- **Keying.** The background is a uniform `rgb(56,49,63)` — every sample point
  read exactly that. Frames are keyed in the browser by colour distance (alpha
  ramps from 14 to 40 units away) and edge pixels are un-mixed against that
  colour, so there's no purple fringe.
- **Black parts.** On a dark stage the black slide and mag vanish, so the clip
  is drawn with a pink halo built from its own alpha.
- **Scale.** The footage is 720p, so it's never shown above 1.6× — that sets the
  finish-03 shots' size, and the reveal pulls the render back to match.

## The finish 02 → 03 match-cut

Every side-on finish-02 render frame was compared with every side-on finish-03
clip frame, silhouettes normalised by bounding box. Best pair: **s0746 ↔ m0302,
3.3% of cells differ**. The two bounding boxes (render 793×859 @ 286,107;
clip 427×459 @ 445,75) give the transform — about 1.86 clip pixels per render
pixel — so the wipe lines the two up.

The first pass of that search returned 11–14% "matches", which turned out to be
a bug in the measurement: the clip silhouette keyed the background to black and
then treated *all* black as background, throwing away finish 03's black slide
and mag. Protecting near-black gun pixels before keying fixed it.
