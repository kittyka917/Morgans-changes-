# canvas-ui WebGL effects

The promo drives two engines from [canvas-ui](https://canvasui.dev) directly:

| Engine | Where | What it does |
|---|---|---|
| `Droplets` | badge (0:02), hook (0:06), end card (0:30) | Real refractive rain on the lens — droplets and runnels that bend the city behind them |
| `Glitch` | montage (0:26) | Shader tearing, RGB split and block corruption on each card change |

`src/lib/` holds the upstream vanilla engines and their three shared helpers,
unmodified. Ten are vendored so others can be swapped in without re-copying.

## Build

```bash
cd fx && tsc -p tsconfig.json
```

Then rewrite the emitted relative imports to carry `.js`, which browsers
require and `tsc` does not add — `build.js` expects `dist/lib/<Name>/<Name>Vanilla.js`.

## Why there is a driver

The engines are built for live pages, and two things had to be solved to
render them to a file frame-by-frame.

**They run their own clock.** Each engine owns a `requestAnimationFrame` loop
and accumulates `time` from `performance.now()` deltas. Rendering offline that
way would make every run differ. `driver.js` replaces `performance.now()` with
a clock stepped by exactly 1/30s and queues rAF callbacks instead of running
them, so the engine advances one frame per rendered frame and renders are
reproducible.

**They only texture their source canvas under html-in-canvas.** That is an
experimental Chrome API; without it `uploadContent()` early-returns and you get
the bare overlay rather than your content. The engines feature-detect exactly
two things — `drawElementImage()` on the source 2D context and `requestPaint()`
on the source canvas. `driver.js` supplies both, so the real code path runs and
uploads *our* frame as the texture. No library edits, no browser flag.

Two things that cost real time, worth knowing before changing this:

- **`content` must be a laid-out element.** Engines read `content.clientWidth`
  to size the content region. Nesting it inside the `<canvas>` makes it
  fallback content, which is never laid out, so `clientWidth` is 0 and the
  shaders clip to a 5% strip down the left edge.
- **Stubbing rAF starves Playwright's `screenshot()`**, which waits for a
  compositor frame that never arrives. Capture with `canvas.toDataURL()`
  instead — `build.js` and `smoke.js` both do.

## Parallel rendering

`build.js` splits the film across workers, so a worker can start mid-scene
where an engine's internal `time` would otherwise begin at zero. Each effect is
scoped to its scene and silently pre-rolled from that scene's first frame when
the sequence is broken. Drop geometry depends on time rather than on the
content texture, so pre-rolling against the current frame is exact.

Verified: frame-to-frame deltas at the worker boundaries (0.026 / 0.044 /
0.008 RMSE) sit at or below ordinary consecutive-frame deltas in the same
scenes (0.016 – 0.109), so the seams are invisible.

## Performance

Software WebGL (SwiftShader) at 1080p, measured here: Droplets 58 ms/frame,
Glitch 46, Frost 37, VHS 43, Liquid 33, Displacement 45, Ripple 44. Effects run
on about half the film, which took the full render from 242s to 406s.

`Glass` renders empty — it is a lens effect needing target rects, which this
pipeline does not supply.
