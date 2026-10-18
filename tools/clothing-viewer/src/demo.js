// Generates a small demo outfit as real .ydd / .ytd bytes, so the viewer opens
// in a working state and the demo goes through the same parser as real files.
// Coordinates are GTA style: metres, Z up, ped pelvis near z = 0.

import { writeYdd, writeYtd } from './rscwrite.js';

const COLLECTION = 'demo_mp_m_freemode_01';

// A tube between two centre points, with elliptical radii (rx, ry) at each end.
function tube(geom, a, b, ra, rb, { segments = 28, rings = 10, u0 = 0, u1 = 1, v0 = 0, v1 = 1 } = {}) {
  const base = geom.positions.length / 3;
  const axis = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...axis);
  const w = axis.map((c) => c / len);
  // Pick a side vector that is never parallel to the axis.
  const ref = Math.abs(w[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const s = [w[1] * ref[2] - w[2] * ref[1], w[2] * ref[0] - w[0] * ref[2], w[0] * ref[1] - w[1] * ref[0]];
  const sl = Math.hypot(...s);
  const u = s.map((c) => c / sl);
  const v = [w[1] * u[2] - w[2] * u[1], w[2] * u[0] - w[0] * u[2], w[0] * u[1] - w[1] * u[0]];
  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const c = [a[0] + axis[0] * t, a[1] + axis[1] * t, a[2] + axis[2] * t];
    const rx = ra[0] + (rb[0] - ra[0]) * t, ry = ra[1] + (rb[1] - ra[1]) * t;
    for (let i = 0; i <= segments; i++) {
      const ang = (i / segments) * Math.PI * 2;
      const cx = Math.cos(ang), cy = Math.sin(ang);
      for (let k = 0; k < 3; k++) geom.positions.push(c[k] + u[k] * cx * rx + v[k] * cy * ry);
      const n = [0, 1, 2].map((k) => u[k] * cx * ry + v[k] * cy * rx);
      const nl = Math.hypot(...n) || 1;
      geom.normals.push(n[0] / nl, n[1] / nl, n[2] / nl);
      geom.uvs.push(u0 + (u1 - u0) * (i / segments), v0 + (v1 - v0) * t);
    }
  }
  const row = segments + 1;
  for (let r = 0; r < rings; r++) {
    for (let i = 0; i < segments; i++) {
      const p = base + r * row + i;
      geom.indices.push(p, p + 1, p + row, p + 1, p + row + 1, p + row);
    }
  }
}

// Upper hemisphere dome for the cap crown.
function dome(geom, centre, radius, { segments = 32, rings = 10 } = {}) {
  const base = geom.positions.length / 3;
  for (let r = 0; r <= rings; r++) {
    const phi = (r / rings) * (Math.PI / 2);
    for (let i = 0; i <= segments; i++) {
      const th = (i / segments) * Math.PI * 2;
      const n = [Math.cos(th) * Math.cos(phi), Math.sin(th) * Math.cos(phi), Math.sin(phi)];
      geom.positions.push(centre[0] + n[0] * radius, centre[1] + n[1] * radius * 1.08, centre[2] + n[2] * radius * 0.82);
      geom.normals.push(...n);
      geom.uvs.push(i / segments, 0.75 - (r / rings) * 0.75);
    }
  }
  const row = segments + 1;
  for (let r = 0; r < rings; r++) {
    for (let i = 0; i < segments; i++) {
      const p = base + r * row + i;
      geom.indices.push(p, p + row, p + 1, p + 1, p + row, p + row + 1);
    }
  }
}

// Flat half-disc brim on one side of the cap.
function brim(geom, centre, inner, outer, z) {
  const base = geom.positions.length / 3;
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const th = Math.PI * (1.15 + (i / steps) * 0.7);
    for (const [r, vv] of [[inner, 0.8], [outer, 1]]) {
      geom.positions.push(centre[0] + Math.cos(th) * r, centre[1] + Math.sin(th) * r * 1.2, z - (r - inner) * 0.15);
      geom.normals.push(0, 0, 1);
      geom.uvs.push(i / steps, vv);
    }
  }
  for (let i = 0; i < steps; i++) {
    const p = base + i * 2;
    geom.indices.push(p, p + 1, p + 2, p + 1, p + 3, p + 2);
  }
}

const empty = () => ({ positions: [], normals: [], uvs: [], indices: [] });

// Procedural fabric patterns, returned as A8R8G8B8 (memory order B G R A).
function fabric(size, pick) {
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pick(x / size, y / size, x, y);
      // Fine weave noise so the fabric doesn't read as flat plastic.
      const weave = ((x ^ y) & 1 ? 6 : -6) + (((x * 7 + y * 13) % 5) - 2) * 2;
      const o = (y * size + x) * 4;
      out[o] = clamp(b + weave); out[o + 1] = clamp(g + weave); out[o + 2] = clamp(r + weave); out[o + 3] = 255;
    }
  }
  return out;
}
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => a.map((c, i) => c + (b[i] - c) * t);

const PATTERNS = {
  solid: (base) => (u, v) => {
    const seam = Math.abs(u - 0.5) < 0.006 || v > 0.965 ? 0.55 : 1; // side seam and hem stitching
    return hexRgb(base).map((c) => c * seam);
  },
  stripe: (a, b) => (u, v) => (Math.floor(v * 14) % 2 ? hexRgb(a) : hexRgb(b)),
  plaid: (a, b, line) => (u, v) => {
    const band = (t) => (Math.floor(t * 10) % 3 === 0 ? 0.5 : 0);
    let c = mix(hexRgb(a), hexRgb(b), band(u) + band(v));
    if (Math.abs((u * 20) % 1 - 0.5) < 0.04 || Math.abs((v * 20) % 1 - 0.5) < 0.04) c = hexRgb(line);
    return c;
  },
  denim: (base) => (u, v, x, y) => {
    const twill = ((x + y) % 4 < 2 ? 1.08 : 0.92);
    const fade = 1 + 0.18 * Math.exp(-((v - 0.35) ** 2) / 0.01);
    return hexRgb(base).map((c) => c * twill * fade);
  },
};

const SIZE = 128;

function textureEntry(name, pattern) {
  return { name, width: SIZE, height: SIZE, format: 21, stride: SIZE * 4, pixels: fabric(SIZE, pattern) };
}

function shirt() {
  const g = empty();
  tube(g, [0, 0, -0.08], [0, 0, 0.5], [0.19, 0.13], [0.21, 0.14], { u0: 0, u1: 1, v0: 1, v1: 0.3 });
  tube(g, [0.2, 0, 0.44], [0.42, 0, 0.18], [0.07, 0.07], [0.055, 0.055], { segments: 16, rings: 6, u0: 0, u1: 0.5, v0: 0.28, v1: 0 });
  tube(g, [-0.2, 0, 0.44], [-0.42, 0, 0.18], [0.07, 0.07], [0.055, 0.055], { segments: 16, rings: 6, u0: 0.5, u1: 1, v0: 0.28, v1: 0 });
  return g;
}

function trousers() {
  const g = empty();
  tube(g, [0, 0, -0.12], [0, 0, 0.04], [0.18, 0.12], [0.18, 0.12], { rings: 3, v0: 0.12, v1: 0 });
  tube(g, [0.09, 0, -0.1], [0.11, 0, -0.98], [0.085, 0.085], [0.06, 0.065], { segments: 20, u0: 0, u1: 0.5, v0: 0.14, v1: 1 });
  tube(g, [-0.09, 0, -0.1], [-0.11, 0, -0.98], [0.085, 0.085], [0.06, 0.065], { segments: 20, u0: 0.5, u1: 1, v0: 0.14, v1: 1 });
  return g;
}

function cap() {
  const g = empty();
  dome(g, [0, 0, 0.66], 0.105);
  brim(g, [0, 0], 0.1, 0.17, 0.665);
  return g;
}

// Returns [{ path, file }] in the same shape the folder loader produces.
export async function buildDemoEntries() {
  const files = [];
  const add = (name, bytes) => files.push({ path: `${COLLECTION}^${name}`, file: new Blob([bytes]), demo: true });

  add('jbib_000_u.ydd', await writeYdd({ name: 'jbib_000_u', diffuseName: 'jbib_diff_000_a_uni', geometries: [shirt()] }));
  const shirts = [
    ['a', PATTERNS.solid('#2f5d8a')],
    ['b', PATTERNS.stripe('#f2efe6', '#22313f')],
    ['c', PATTERNS.plaid('#8c2f2f', '#2b2b2b', '#e0c36a')],
  ];
  for (const [l, p] of shirts) add(`jbib_diff_000_${l}_uni.ytd`, await writeYtd([textureEntry(`jbib_diff_000_${l}_uni`, p)]));

  add('lowr_000_u.ydd', await writeYdd({ name: 'lowr_000_u', diffuseName: 'lowr_diff_000_a_uni', geometries: [trousers()], layout: 'packed' }));
  add('lowr_diff_000_a_uni.ytd', await writeYtd([textureEntry('lowr_diff_000_a_uni', PATTERNS.denim('#3a5578'))]));
  add('lowr_diff_000_b_uni.ytd', await writeYtd([textureEntry('lowr_diff_000_b_uni', PATTERNS.solid('#6b6450'))]));

  add('p_head_000.ydd', await writeYdd({ name: 'p_head_000', diffuseName: 'p_head_diff_000_a', geometries: [cap()] }));
  add('p_head_diff_000_a.ytd', await writeYtd([textureEntry('p_head_diff_000_a', PATTERNS.solid('#c9a227'))]));
  add('p_head_diff_000_b.ytd', await writeYtd([textureEntry('p_head_diff_000_b', PATTERNS.plaid('#2d4a3e', '#1b2b24', '#d9d0b4'))]));
  return files;
}
