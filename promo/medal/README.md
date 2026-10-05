# Morgie's Gun Showcase

The personal-project version of the Glock showcase: 34.95 seconds,
1080p/60, all MainStreet branding removed, and two more finishes added from
viewer screen recordings — finish 03 (black slide, this folder) and finish 04
(BLOSSOM, `blossom/`). `glock.html` (the MainStreet version) is untouched apart
from accepting full-resolution source frames; this is `morgie.html`.

The music is your song (`music/song.mp3`, kept out of git) and the edit is cut
to it. Its beat grid was measured with librosa — 140.0 BPM, a beat every
0.4285s from 1.388s, first hit on bar 1 (3.10s), the drop on bar 8 (15.10s) —
and `BEAT0` / `BEAT` in `morgie.html` hold it. Every cut lands on a beat, and
the three finish swaps land on bar 5, the drop, and bar 12.

| Time | Shot |
|---|---|
| 0:00 | Strobed open — one strobe on each of the song's first four beats |
| 0:03.1 | Finish 01 hero spin (the song's first hit) |
| 0:06.5 | Finish 01 details |
| 0:09.1 | Scan-line wipe to **finish 02**; swap on bar 5 (9.96s) |
| 0:10.8 | Finish 02 spins and settles |
| 0:13.4 | Pull back; scan line wipes into **finish 03** — the swap is the drop (15.10s) |
| 0:16.8 | Finish 03 side-on hold; four callouts |
| 0:21.1 | An iris of petals opens on **finish 04, BLOSSOM**; swap on bar 12 (21.96s) |
| 0:22.8 | BLOSSOM does one full turn |
| 0:25.4 | Settles side-on; five callouts |
| 0:28.8 | All four finishes side by side |
| 0:31.4 | End card: MORGIE'S GUN SHOWCASE; fades out with the song |

Finish titles are descriptive — `CASH WRAP`, `PINK SLIDE`, `BLACK SLIDE`,
and `BLOSSOM` (the name the viewer gives finish 04) —
since finishes 02 and 03 both carry MORGAN on the slide. The brand strings are
`BRAND` / `BRAND_SUB` at the top of the new block in `morgie.html`.

## Picture quality

- **60 fps.** All three sources are 60 fps, so every output frame is a real
  source frame or a blend of two neighbours.
- **Full-resolution sources.** The turntable render is kept at its native
  1920×1440; the two 720p screen recordings are cropped then upscaled 2× with
  Lanczos and a light unsharp before keying. The page still lays everything
  out in the old logical sizes, so no coordinates changed.
- **Clean pass** (`CLEAN` in `morgie.html`): 0.4× chromatic aberration, no
  gate weave, half the handheld drift, a third of the grain, lighter glitch
  hits. Grade, bloom and light are unchanged.
- **Lossless frames** (`FMT=png`) and a high-bitrate encode (CRF 12).

## Build

```bash
./glock/extract.sh path/to/render.mp4          # finishes 01 and 02 (once)
./medal/extract.sh path/to/recording.mp4       # finish 03 (once)
./blossom/extract.sh path/to/blossom.mp4       # finish 04 (once)
cp path/to/song.mp3 music/song.mp3             # the music (once)
PAGE=morgie.html OUTDIR=mframes FMT=png node build.js   # 2097 PNG frames
# the song: trimmed to the video, 1.2s fade, two-pass loudnorm to -14 LUFS / -1 dBTP
#   (pass 1 prints the measured_* values for pass 2 — see music/README.md)
ffmpeg -y -framerate 60 -i mframes/f%05d.png -i music/song_master.wav \
  -c:v libx264 -preset slow -crf 12 -profile:v high -pix_fmt yuv420p -r 60 -g 120 \
  -c:a aac -b:a 320k -ar 48000 -ac 2 -af apad -t 34.95 \
  -movflags +faststart morgies-gun-showcase.mp4
```

`score_morgie.py` (the synthesized bed this replaced) is still in the repo but
no longer used.

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
