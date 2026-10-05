# Custom Glock showcase

A 20-second, 1080p/30 showcase built from the turntable render of the custom
Glock (`mainstreet_customweapons`). The render itself is the footage; the
renderer stages it, cuts it, and scores it.

| Time | Shot |
|---|---|
| 0:00 | Black, typed slug, four strobed macro glimpses with a shader glitch on each |
| 0:02 | Hero spin, finish 01 — giant outlined `GLOCK` behind, petals, light sweep |
| 0:06 | Speed ramp into a near-freeze; four callouts land on the beat |
| 0:10 | Scan line wipes finish 01 into finish 02 on the same pose; the drop hits at 0:11 |
| 0:12 | Finish 02 spins round and settles; three more callouts |
| 0:16 | Both finishes side by side |
| 0:18 | End card |

## Build

```bash
./glock/extract.sh path/to/render.mp4                 # once
PAGE=glock.html OUTDIR=gframes node build.js          # 600 frames, ~2 min on 4 cores
python3 score_glock.py                                # score_glock.wav
ffmpeg -y -framerate 30 -i gframes/f%05d.jpg -i score_glock.wav \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -r 30 \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -shortest -movflags +faststart morgan-glock-showcase.mp4
```

`PAGE=glock.html PICKS=100,330,445 node smoke.js` renders single frames for checking.

## How the render is used

- **Compositing.** The render is on pure black, so each frame is drawn with a
  `screen` blend: the black drops out and the white gun sits on the stage. A
  light `contrast()` crushes the near-black floor first so it doesn't lift the
  background.
- **Slow motion** blends the two nearest source frames rather than repeating
  one, so the speed ramp into the detail section glides instead of stepping.
  The source is 60fps, so 0.5x slow motion is still one fresh frame per output
  frame.
- **Lazy loading.** Decoding all 766 frames up front would need about 4.8 GB.
  `prepFrame(n)` runs the scene once in a collect pass to learn which source
  frames it touches, loads just those into a 32-frame LRU, then `renderFrame(n)`
  draws for real. Both harnesses call it when it exists.

## Measured, not eyeballed

| Pose | Source time | How it was found |
|---|---|---|
| Finish swap | 7.57s (frame 455 → 456) | Largest frame-to-frame RMSE between 7s and 8s |
| Finish 01 hold | 4.500s | Clean side-on view for the callouts |
| Finish 02 match | 9.500s | Lowest silhouette difference to the 4.500s hold — 1.2% of pixels |
| Finish 02 hold | 12.200s | Clean mirrored view for the second set of callouts |

The 1.2% silhouette match is what makes the 0:10 wipe read as one gun changing
finish rather than two guns swapping.

## Two things worth knowing before editing

- **Shine sweep.** `shine()` multiplies a light band by the gun on a scratch
  canvas, then adds it. The scratch canvas must be filled opaque black first:
  canvas `multiply` over a *transparent* backdrop passes the source through
  unchanged, so the whole gun gets added a second time and blows out to white.
- **Callout anchors** are in source-frame pixels (1440x1080) and run through
  `anchorAt()`, so they follow the gun through the camera push. If you change
  the hold times, re-read the anchors off the new hold frame.

## Wording

The callouts describe only what is visible on the model. `CASH WRAP` and
`MORGAN` in the side-by-side are descriptive labels, not official finish names
— change them in `sDuo` if the finishes have real names.
