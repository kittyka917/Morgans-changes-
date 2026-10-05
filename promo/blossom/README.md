# Finish 04 — BLOSSOM

Source for finish 04 in `morgie.html`: a 13.8s Medal screen recording of the
"Blossom — Morgan's sakura pistol · live model" viewer (1280×720 @60fps, 828
frames). `./extract.sh recording.mp4` writes `src/b0001.jpg…b0828.jpg`.

**The finish:** pink slide with white "BL❀SSOM" lettering, sakura vines
(pink blossoms, green leaves) wrapped from slide to suppressor, a pink
suppressor with a cherry-branch print, white frame with pink stippling and a
pink trigger, pink extended mag with white sakura prints and a white baseplate.

## The recording

- **Crop.** The 720×520 window at (280,130). The gun's extent over every usable
  frame is x 370–912, y 182–605 in the full frame, so it never leaves the
  window, and the window misses the viewer's title, view buttons and control
  hint, the browser chrome and the Windows taskbar.
- **b0001–b0072** carry Medal's "Ready to clip" overlay. `morgie.html` never
  reads below b0073.
- **Keying.** The stage is pure black — every sample read (0,0,0). Alpha comes
  from the brightest channel (ramping from 6 to 28) and edge pixels are
  un-mixed against black, so no dark fringe.
- **Exposure.** The viewer lights the white frame close to 255, which clips
  flat under the showcase's bloom, so the clip is drawn at
  `brightness(0.82) contrast(1.10) saturate(1.12)`.

## Frames used

| Clip seconds | Frames | What |
|---|---|---|
| 2.800 | b0169 | inside b0121–b0193, a dead-still side-on hold (bounding box identical across all of it) — the reveal |
| 4.000 → 8.800 | b0241 → b0529 | one full turn — the spin |
| 9.600 | b0577 | side-on again after the turn — the callout hold and the line-up |

The turntable centre stays at crop (360,240) in every shot, so the gun never
jumps between them. Callout anchors were read off b0577 on a measured grid:
lettering (344,95), suppressor (531,94), vines (194,201), trigger (275,150),
mag (150,325).
