# MAINSTREET RP — promotional video

A 36-second 1080p/30 promo for the server, rendered from code. Everything here
is source: re-run the build and you get the MP4 back, byte-identical. There is
no video editor project to lose and no footage to re-license.

## What's in the cut

| Time | Section | On screen |
|---|---|---|
| 0:00 | The drive | A night drive into the city, car ahead, wet road |
| 0:06 | Badge | The MainStreet RP badge, chrome shine sweep |
| 0:10 | Hook | "It's not the city. It's who's in it." |
| 0:14 | §01 Make your name | Outfits, barber, live clothing previews |
| 0:18 | §02 Find your people | Party banners, crew chips, city-wide radio, chat |
| 0:22 | §03 What's on | AFL showcase, airdrops, the streets, event ticker |
| 0:26 | §04 Nobody gets left | AI medic on `F`, crutch + recovery, new death/respawn |
| 0:30 | Montage | HUD, hunger & thirst, loadscreen, interaction, custom weapons… |
| 0:34 | End card | Badge, "Come be part of it", Discord call-to-action |

### The drive

The opening is a real perspective projection, not a flat scrolling grid.
Everything is placed in world units — road, kerbs, centre dashes, streetlight
poles and heads, two rows of buildings, the car ahead — and run through
`roadProject(x, y, z)` with a fixed camera height, so objects scale and
separate correctly as they approach. Distance fog sinks far geometry into the
haze, lights pool and smear on the wet surface, and the speed ramps on an
exponential ease with streaks radiating from the vanishing point.

Tuning lives in `RD` at the top of the scene (focal length, camera height, road
width, lamp spacing, horizon). The things that needed the most care: the sky
has to stay near-black with only a tight bloom at the vanishing point or it
reads as a flat green wall, and `drawLamp` clamps its radius or passing lamps
blow up into frame-filling discs.

The cut runs at 120 BPM with 2-second bars, and **every scene change lands on a
bar line**, so the music hits the cuts rather than drifting against them.

## WebGL effects

Two [canvas-ui](https://canvasui.dev) engines run as part of the render:
`Droplets` puts real refractive rain on the lens over the badge, the hook and
the end card, and `Glitch` tears the montage cuts. They are driven frame-exactly
off a stubbed clock so renders stay reproducible, and their source texture is
fed through a shim rather than the experimental html-in-canvas API. The how and
the two traps that cost real time are in [`fx/README.md`](fx/README.md).

Build them once before the first render:

```bash
cd fx && tsc -p tsconfig.json && cd ..
```

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

## Dropping in city footage

Eight scenes have a footage slot behind the graphics. Put clips in
`media/clips/` and run `node build.js` — the newest clips from the last 35 days
are assigned automatically, cover-fitted to 16:9, graded toward the badge green
and given a slow push. Slots with no clip keep their designed graphics, so the
film always builds. Full detail in [`media/README.md`](media/README.md).

**Clip audio is never used** — the ingest extracts picture frames only, so
there is no path for it to reach the film.

## The look

The post chain, in order, in `renderFrame`:

| Stage | What it does |
|---|---|
| Virtual camera | Handheld float on every shot, plus per-scene dolly and truck moves |
| Atmosphere | Volumetric fog banks, rain, drifting embers, foreground bokeh, light shafts |
| Highlight bloom | True highlights only — isolated by raising the frame to the 4th power, not a contrast curve, which is what stops the badge blowing out |
| Halation | Wider, warmer second bloom pass |
| God rays | Radial smear of the bright pass away from a light point |
| Chromatic aberration | Radial RGB split via channel isolation — zero at centre, strongest at the frame edge |
| Whip smear | Directional blur on the montage cuts (canvas filters only do gaussian, so it's an accumulation pass) |
| Grade | Per-scene contrast/saturation curve |
| Light leaks | Fired just after each cut |
| Grain + gate weave | Grain with extra response in the shadows, plus sub-pixel frame jitter |

Intensities live in each scene's `post:{}` block in the `SCENES` table.
**Restraint is what reads as professional** — the first pass at these values was
roughly triple what's there now and it destroyed the logo.

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
