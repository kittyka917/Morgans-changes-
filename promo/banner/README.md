# Discord server banner

The night drive, rebuilt as a seamless loop, with the road's kerbs and lamp
rows converging on the badge hung above the vanishing point.

## Discord's requirements (support.discord.com, "Server Banners")

| | |
|---|---|
| Size | 960×540 minimum, 16:9 — 1920×1080 is accepted and downscaled |
| Formats | PNG, JPG, GIF |
| File size | 10 MB max |
| Static banner | Server Boost **Level 2** |
| Animated banner | Server Boost **Level 3** |
| Guidance | Keep the top 48px simple (server name is drawn over it); avoid logos/text |

## What this produces

| File | Size | Use |
|---|---|---|
| `mainstreet-banner-1920x1080.png` | 1.83 MB | Static banner, Level 2 |
| `mainstreet-banner-960x540.png` | 0.28 MB | Same, at the minimum size |
| `mainstreet-banner-animated.gif` | 8.92 MB, 960×540, 60 frames @15fps, 4.0s | Animated banner, Level 3 |

## Design decisions

- **It renders about 240px wide** in the desktop sidebar, so the composition is
  one bold idea that survives a thumbnail: leading lines into the badge.
- **The header zone.** Discord's 48px header (the server name) sits over a
  banner that shows ~135px tall in the sidebar — roughly the top third. That
  band is darkened, and the badge's wordmark sits below it. `sidebar-mock.png`
  shows the result with the name overlaid.
- **No text.** Discord already draws the server name; text in the image would
  duplicate it and be illegible at 240px. The badge is used as key art.

## How the loop is seamless

Everything moving is a function of loop phase `p = n / TOTAL` with an integer
number of cycles per loop. The camera travels 182 world units per loop — the
LCM of the dash spacing (14) and lamp spacing (26) — and buildings tile every
182 units. Verified: the 59 → 0 wrap measures 0.046 RMSE, below ordinary
consecutive-frame steps (0.049–0.077).

## Getting under 10 MB

The first GIF was 12.95 MB. What did and didn't work, measured:

| Change | Size |
|---|---|
| 80 frames @20fps, error-diffusion dither, with rain | 12.95 MB |
| Ordered (Bayer) dither instead | 13.11–13.82 MB — *worse* |
| Rain removed from the GIF (kept in the still) | 11.57 MB |
| …and 15fps / 60 frames over the same 4s loop | **8.92 MB** |

Dither wasn't the problem: the rain forced a full-frame update every frame
and was invisible at 240px anyway. Grain is also off in the GIF for the same
reason.

## Build

```bash
# static
PAGE='banner.html?mode=still' PREFIX=bnstill_ PNG=1 PICKS=0 node smoke.js

# animated
PAGE='banner.html?mode=gif' OUTDIR=bframes QUALITY=1.0 node build.js
ffmpeg -y -framerate 15 -i bframes/f%05d.jpg \
  -vf "scale=960:540:flags=lanczos,palettegen=max_colors=256:stats_mode=full" bpal.png
ffmpeg -y -framerate 15 -i bframes/f%05d.jpg -i bpal.png \
  -lavfi "scale=960:540:flags=lanczos[v];[v][1:v]paletteuse=dither=sierra2_4a:diff_mode=rectangle" \
  -loop 0 mainstreet-banner-animated.gif
```

When checking a frame of the GIF, decode it with ffmpeg. With
`diff_mode=rectangle` each frame stores only the changed region, so pulling a
single frame out with ImageMagick shows a bare delta that looks broken.
