# Discord profile banner — Morgan / Morgie

Pink, sakura and tribal: the same finish as the custom Glock. The tribal
ornament behind the name is lifted straight off the gun's grip engraving
(pink strokes isolated where red sits well above green, then mirrored), and
the gun on the right is finish 02 with the MORGAN slide.

## Discord's requirements (support.discord.com, "Custom Profiles")

| | |
|---|---|
| Who | Nitro only, for an image or GIF banner |
| Formats | PNG, JPG, animated GIF |
| File size | under 10 MB |
| Size | Discord's docs give 600×240 (recommended minimum) in one place and 680×240 (minimum) in another |

Built at **1360×480** — twice the larger figure — with everything that matters
inside a centred 5:2 zone, so it holds under either crop. The avatar sits over
the bottom-left corner, so that corner is left empty; `popout-mock.png` shows it.

## Files

| File | Size |
|---|---|
| `morgan-profile-banner.png` / `morgie-profile-banner.png` | ~0.95 MB each, 1360×480 |
| `morgan-profile-banner-animated.gif` | 5.35 MB, 1360×480, 45 frames @15fps, 3.0s loop |
| `morgie-profile-banner-animated.gif` | 5.15 MB, same |

Loop seams verified: the 44 → 0 wrap measures 0.042 RMSE, inside the range of
ordinary frame steps (0.040–0.044).

## Build

```bash
# still
PAGE='profile.html?name=MORGAN&mode=still' PREFIX=pf_ PNG=1 PICKS=0 node smoke.js
# animated
PAGE='profile.html?name=MORGAN&mode=gif' OUTDIR=pframes QUALITY=1.0 node build.js
ffmpeg -y -framerate 15 -i pframes/f%05d.jpg \
  -vf "palettegen=max_colors=256:stats_mode=full" ppal.png
ffmpeg -y -framerate 15 -i pframes/f%05d.jpg -i ppal.png \
  -lavfi "[0:v][1:v]paletteuse=dither=sierra2_4a:diff_mode=rectangle" -loop 0 banner.gif
```

`name=` takes any text; names longer than six letters get a slightly smaller
size. The "A.K.A. MORGIE" line only appears on the MORGAN version.

In GIF mode the background glow pulse, the tribal shimmer and the drifting
light rakes are frozen: each changes every pixel every frame, which defeats
GIF compression. The still keeps them.
