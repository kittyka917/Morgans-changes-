/* =======================================================================
   Deterministic driver for the canvas-ui WebGL engines.

   The engines are built for live pages: they run their own rAF loop off
   performance.now(), and they only texture their source canvas when the
   experimental html-in-canvas API is present (otherwise uploadContent()
   early-returns and you get the bare overlay).

   For frame-exact offline rendering we need neither of those behaviours, so
   this module:
     1. replaces performance.now() with a clock we step by exactly 1/FPS
        (the page's window.FPS_OUT, 30 if unset),
        and queues requestAnimationFrame callbacks instead of running them,
        so engine `time` advances identically on every render; and
     2. shims drawElementImage()/requestPaint() on the source canvas, which
        is the pair the engines feature-detect. That makes the real
        html-in-canvas code path run and upload OUR frame as the texture —
        no library edits, no experimental browser flag.
   ======================================================================= */

let clock = 0;
let queue = [];

export function installClock(){
  clock = 0; queue = [];
  const perf = window.performance;
  perf.now = () => clock;
  window.requestAnimationFrame = (cb) => { queue.push(cb); return queue.length; };
  window.cancelAnimationFrame = (id) => { if (id >= 1 && id <= queue.length) queue[id-1] = null; };
  // Engines bail out of animating entirely under reduced motion.
  const mm = window.matchMedia;
  window.matchMedia = (q) => {
    if (/prefers-reduced-motion/.test(q))
      return { matches:false, media:q, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} };
    return mm.call(window, q);
  };
}

/** Run every queued rAF callback once, at the current clock. */
export function flush(){
  const due = queue; queue = [];
  for (const cb of due) { if (cb) try { cb(clock); } catch(e) { console.error('rAF', e); } }
}

export function setFrame(n){ clock = n * 1000 / (window.FPS_OUT || 30); }

/* Build the source/content/output trio an engine expects, with the shim in
   place. `paint` is called with the source 2D context to draw each frame. */
export function makeStage(host, w, h){
  const source = document.createElement('canvas');
  source.width = w; source.height = h;
  source.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px`;
  // `content` must be a REAL laid-out element: engines read content.clientWidth
  // to decide how much of the frame holds content. Nesting it inside the
  // <canvas> makes it fallback content, which is never laid out, so
  // clientWidth is 0 and the shaders clip to a 5% strip.
  const content = document.createElement('div');
  content.style.cssText =
    `position:absolute;left:0;top:0;width:${w}px;height:${h}px;pointer-events:none`;
  host.appendChild(content);
  const output = document.createElement('canvas');
  output.width = w; output.height = h;
  output.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px`;
  host.appendChild(source); host.appendChild(output);

  const ctx = source.getContext('2d');
  let painter = null;
  // The exact pair createX() feature-detects for html-in-canvas.
  ctx.drawElementImage = function(){ if (painter) painter(ctx); };
  source.requestPaint = function(){ if (typeof source.onpaint === 'function') source.onpaint(); };

  return {
    source, content, output, ctx,
    setPainter(fn){ painter = fn; },
    /** Push a new frame into the engine's texture, then advance it one frame. */
    step(n){ setFrame(n); source.requestPaint(); flush(); }
  };
}
