import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { loadYdd, drawableStats } from './ydd.js';
import { loadYtd } from './ytd.js';
import { buildCatalog, textureLabel, slotInfo } from './naming.js';
import { buildDemoEntries } from './demo.js';

// The hosted copy can't start downloads, so its build sets this to hide the export buttons.
const NO_EXPORT = typeof globalThis.SEAMLINE_NO_EXPORT !== 'undefined' && globalThis.SEAMLINE_NO_EXPORT === true;
const $ = (id) => document.getElementById(id);
const el = {
  summary: $('summary'), tree: $('tree'), search: $('search'), fileCount: $('file-count'),
  stage: $('stage'), gl: $('gl'), flat: $('flat'), overlay: $('overlay'), overlayMsg: $('overlay-msg'),
  drop: $('drop'), tape: $('tape'), inspect: $('inspect'), toast: $('toast'),
  folderInput: $('folder-input'), filesInput: $('files-input'),
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => n.toLocaleString('en-US');

function store(key, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(`seamline:${key}`));
    localStorage.setItem(`seamline:${key}`, JSON.stringify(value));
  } catch { /* storage unavailable: settings just don't persist */ }
  return null;
}

// ---------------------------------------------------------------- state

const state = {
  entries: [],
  catalog: { collections: [], looseTextures: [], allTextures: [] },
  visible: [], // flattened, filtered list of selectable rows: { type: 'item'|'loose', ref }
  selected: null, // { type, ref }
  drawable: null,
  drawables: [],
  drawableIndex: 0,
  variants: [], // [{ key, label, entry?, texture?, status, thumb }]
  variantIndex: -1,
  lod: 'high',
  wire: false,
  alpha: store('alpha') ?? true,
  grid: store('grid') ?? true,
  spin: false,
  collapsed: new Set(store('collapsed') || []),
  problems: [],
  token: 0, // guards against out-of-order async selection
};

const yddCache = new Map(); // entry.path -> Promise<{drawables}>
const ytdCache = new Map(); // entry.path -> Promise<{textures}>
const rgbaCache = new WeakMap(); // texture -> Uint8Array

async function readBytes(entry) {
  return new Uint8Array(await entry.file.arrayBuffer());
}
function getYdd(entry) {
  if (!yddCache.has(entry.path)) yddCache.set(entry.path, readBytes(entry).then(loadYdd));
  return yddCache.get(entry.path);
}
function getYtd(entry) {
  if (!ytdCache.has(entry.path)) ytdCache.set(entry.path, readBytes(entry).then(loadYtd));
  return ytdCache.get(entry.path);
}
function rgbaOf(texture) {
  if (!rgbaCache.has(texture)) rgbaCache.set(texture, texture.decode());
  return rgbaCache.get(texture);
}
function pickTexture(textures, entry) {
  const stem = entry?.info?.name;
  return textures.find((t) => t.name && t.name.toLowerCase() === stem) || textures[0] || null;
}

function addProblem(path, message) {
  if (state.problems.some((p) => p.path === path)) return;
  state.problems.push({ path, message });
}

// ---------------------------------------------------------------- three.js

const renderer = new THREE.WebGLRenderer({ canvas: el.gl, antialias: true, preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
camera.position.set(1.2, 0.9, 1.8);
const controls = new OrbitControls(camera, el.gl);
controls.enableDamping = true;
controls.autoRotateSpeed = 1.6;

scene.add(new THREE.HemisphereLight(0xffffff, 0x404848, 1.4));
const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(2, 3, 2.5);
scene.add(key);
const rim = new THREE.DirectionalLight(0xffffff, 0.6);
rim.position.set(-2, 1.5, -2.5);
scene.add(rim);

// GTA is Z-up; three.js is Y-up.
const root = new THREE.Group();
root.rotation.x = -Math.PI / 2;
scene.add(root);
let modelGroup = null;
const materials = new Map(); // shader index -> material
let currentTexture = null;

const gridGroup = new THREE.Group();
scene.add(gridGroup);

function cssColor(name) {
  return new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#000');
}

// Cutting mat: 10 cm minor squares, 50 cm major lines, 3 m across.
function buildGrid(y) {
  gridGroup.clear();
  const half = 1.5, minor = [], major = [];
  for (let i = -15; i <= 15; i++) {
    const v = i * 0.1;
    const list = i % 5 === 0 ? major : minor;
    list.push(-half, 0, v, half, 0, v, v, 0, -half, v, 0, half);
  }
  const mk = (arr, color) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color }));
  };
  gridGroup.add(mk(minor, cssColor('--mat-minor')), mk(major, cssColor('--mat-major')));
  gridGroup.position.y = y;
  gridGroup.visible = state.grid;
}

function applyTheme() {
  scene.background = cssColor('--mat');
  buildGrid(gridGroup.position.y);
  requestRender();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

let needsRender = true;
function requestRender() { needsRender = true; }
controls.addEventListener('change', requestRender);

function resize() {
  const r = el.stage.getBoundingClientRect();
  const w = Math.max(1, Math.floor(r.width)), h = Math.max(1, Math.floor(r.height));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  requestRender();
  if (!el.flat.hidden) drawFlat();
}
new ResizeObserver(resize).observe(el.stage);

function loop() {
  requestAnimationFrame(loop);
  const moving = controls.update();
  if (needsRender || moving || state.spin) {
    renderer.render(scene, camera);
    needsRender = false;
  }
}

function disposeModel() {
  if (!modelGroup) return;
  modelGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  root.remove(modelGroup);
  modelGroup = null;
  for (const m of materials.values()) m.dispose();
  materials.clear();
}

function makeMaterial() {
  return new THREE.MeshStandardMaterial({
    color: currentTexture ? 0xffffff : 0xb9c2c8,
    map: currentTexture,
    roughness: 0.88,
    metalness: 0,
    side: THREE.DoubleSide,
    alphaTest: state.alpha ? 0.4 : 0,
    wireframe: state.wire,
  });
}

function buildModel(drawable, lod) {
  disposeModel();
  const models = drawable.lods[lod] || [];
  modelGroup = new THREE.Group();
  for (const model of models) {
    for (const g of model.geometries) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(g.positions, 3));
      if (g.normals) geom.setAttribute('normal', new THREE.BufferAttribute(g.normals, 3));
      if (g.uvs) geom.setAttribute('uv', new THREE.BufferAttribute(g.uvs, 2));
      geom.setIndex(new THREE.BufferAttribute(g.indices, 1));
      if (!g.normals) geom.computeVertexNormals();
      if (!materials.has(g.shaderIndex)) materials.set(g.shaderIndex, makeMaterial());
      const mesh = new THREE.Mesh(geom, materials.get(g.shaderIndex));
      mesh.name = `${drawable.name || 'drawable'}_${g.shaderIndex}`;
      modelGroup.add(mesh);
    }
  }
  modelGroup.name = drawable.name || 'drawable';
  root.add(modelGroup);
  requestRender();
}

function frameModel(keepAngle = false) {
  if (!modelGroup) return;
  const box = new THREE.Box3().setFromObject(modelGroup);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.length() / 2, 0.05);
  // Fit the bounding sphere inside the narrower of the two fields of view, with room for the toolbar.
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const dist = (radius / Math.sin(Math.min(vfov, hfov) / 2)) * 1.18;
  const dir = keepAngle ? camera.position.clone().sub(controls.target).normalize() : new THREE.Vector3(0.45, 0.28, 1).normalize();
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(dir, dist);
  camera.near = dist / 100;
  camera.far = dist * 100;
  camera.updateProjectionMatrix();
  buildGrid(box.min.y - 0.002);
  // Tape readout in GTA axes: X width, Y depth, Z height (world Y after the root rotation).
  el.tape.innerHTML = [['W', size.x], ['D', size.z], ['H', size.y]]
    .map(([k, v]) => `<span><b>${k}</b>${(v * 100).toFixed(1)} cm</span>`).join('');
  el.tape.hidden = false;
  requestRender();
}

function setTexture(rgba, width, height) {
  if (currentTexture) currentTexture.dispose();
  currentTexture = null;
  if (rgba) {
    const t = new THREE.DataTexture(rgba, width, height, THREE.RGBAFormat);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    t.needsUpdate = true;
    currentTexture = t;
  }
  for (const m of materials.values()) {
    m.map = currentTexture;
    m.color.set(currentTexture ? 0xffffff : 0xb9c2c8);
    m.needsUpdate = true;
  }
  requestRender();
}

// ---------------------------------------------------------------- overlays

function showOverlay(html, isError = false) {
  el.overlayMsg.innerHTML = html;
  el.overlay.classList.toggle('error', isError);
  el.overlay.hidden = false;
}
function hideOverlay() { el.overlay.hidden = true; }

let toastTimer = 0;
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, 2600);
}

// 2D texture preview, used for textures that have no matching model.
let flatImage = null;
function drawFlat() {
  const c = el.flat;
  const r = el.stage.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio, 2);
  c.width = Math.floor(r.width * dpr);
  c.height = Math.floor(r.height * dpr);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  if (!flatImage) return;
  const pad = 56 * dpr;
  const scale = Math.min((c.width - pad * 2) / flatImage.width, (c.height - pad * 2) / flatImage.height, 8);
  const w = flatImage.width * scale, h = flatImage.height * scale;
  const x = (c.width - w) / 2, y = (c.height - h) / 2;
  const s = 10 * dpr;
  for (let yy = 0; yy < h; yy += s) {
    for (let xx = 0; xx < w; xx += s) {
      ctx.fillStyle = ((xx + yy) / s) % 2 ? '#d0d6da' : '#f2f4f5';
      ctx.fillRect(x + xx, y + yy, Math.min(s, w - xx), Math.min(s, h - yy));
    }
  }
  ctx.imageSmoothingEnabled = scale < 1;
  ctx.drawImage(flatImage, x, y, w, h);
}
function showFlat(canvas) {
  flatImage = canvas;
  el.flat.hidden = !canvas;
  el.gl.style.visibility = canvas ? 'hidden' : 'visible';
  $('toolbar').hidden = !!canvas;
  if (canvas) drawFlat();
}

function rgbaToCanvas(rgba, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.byteLength), w, h), 0, 0);
  return c;
}
function thumbOf(rgba, w, h) {
  const src = rgbaToCanvas(rgba, w, h);
  const size = 96;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, size, size);
  return c.toDataURL();
}

// ---------------------------------------------------------------- tree

function flattenVisible() {
  const q = el.search.value.trim().toLowerCase();
  const match = (s) => !q || s.toLowerCase().includes(q);
  const out = [];
  const groups = [];
  for (const coll of state.catalog.collections) {
    const slots = [];
    for (const slot of coll.slots) {
      const items = slot.items.filter((it) => match(it.name) || match(coll.name) || match(slot.label));
      if (items.length) slots.push({ slot, items });
    }
    if (slots.length) groups.push({ coll, slots });
  }
  const loose = state.catalog.looseTextures.filter((t) => match(t.info.name));
  for (const g of groups) {
    for (const s of g.slots) {
      const k = `${g.coll.name}|${s.slot.key}`;
      if (state.collapsed.has(k) && !q) continue;
      for (const it of s.items) out.push({ type: 'item', ref: it });
    }
  }
  if (loose.length && !(state.collapsed.has('|loose') && !q)) for (const t of loose) out.push({ type: 'loose', ref: t });
  return { groups, loose, rows: out };
}

function renderTree() {
  const { groups, loose, rows } = flattenVisible();
  state.visible = rows;
  const q = el.search.value.trim();
  const chev = '<svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
  const sel = state.selected?.ref;
  let html = '';
  for (const g of groups) {
    html += `<div class="coll"><div class="coll-name">${esc(g.coll.name)}</div>`;
    for (const s of g.slots) {
      const k = `${g.coll.name}|${s.slot.key}`;
      const open = !state.collapsed.has(k) || !!q;
      const sid = s.slot.id !== undefined ? `<span class="sid">${s.slot.key} · ${s.slot.id}</span>` : '';
      html += `<button class="slot-head" type="button" data-slot="${esc(k)}" aria-expanded="${open}">${chev}${esc(s.slot.label)} ${sid}<span class="count">${s.items.length}</span></button>`;
      if (open) {
        for (const it of s.items) {
          const n = it.textures.length;
          html += `<button class="item" type="button" role="option" data-item="${esc(it.id)}" aria-selected="${it === sel}">`
            + `<span class="name">${esc(it.name)}</span><span class="tex${n ? '' : ' none'}">${n ? `${n} tex` : 'no tex'}</span></button>`;
        }
      }
    }
    html += '</div>';
  }
  if (loose.length) {
    const open = !state.collapsed.has('|loose') || !!q;
    html += `<div class="coll"><div class="coll-name">Textures without a matching model</div>`
      + `<button class="slot-head" type="button" data-slot="|loose" aria-expanded="${open}">${chev}Loose textures<span class="count">${loose.length}</span></button>`;
    if (open) {
      for (const t of loose) {
        html += `<button class="item" type="button" role="option" data-loose="${esc(t.path)}" aria-selected="${t === sel}"><span class="name">${esc(t.info.name)}</span></button>`;
      }
    }
    html += '</div>';
  }
  if (!html) {
    html = state.entries.length
      ? `<div class="tree-empty">Nothing matches “${esc(q)}”.</div>`
      : '<div class="tree-empty">Open your resource\'s <b>stream</b> folder. Models and textures are paired by name, e.g. <code>jbib_000_u.ydd</code> with <code>jbib_diff_000_a_uni.ytd</code>.</div>';
  }
  el.tree.innerHTML = html;
  el.tree.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
}

el.tree.addEventListener('click', (e) => {
  const slot = e.target.closest('[data-slot]');
  if (slot) {
    const k = slot.dataset.slot;
    if (state.collapsed.has(k)) state.collapsed.delete(k); else state.collapsed.add(k);
    store('collapsed', [...state.collapsed]);
    renderTree();
    return;
  }
  const item = e.target.closest('[data-item]');
  if (item) {
    const row = state.visible.find((r) => r.type === 'item' && r.ref.id === item.dataset.item);
    if (row) select(row);
    return;
  }
  const loose = e.target.closest('[data-loose]');
  if (loose) {
    const row = state.visible.find((r) => r.type === 'loose' && r.ref.path === loose.dataset.loose);
    if (row) select(row);
  }
});
el.search.addEventListener('input', renderTree);

// ---------------------------------------------------------------- selection

async function select(row) {
  state.selected = row;
  const token = ++state.token;
  renderTree();
  if (row.type === 'loose') return selectLoose(row.ref, token);
  return selectItem(row.ref, token);
}

async function selectItem(item, token) {
  showFlat(null);
  hideOverlay();
  state.variants = [];
  state.variantIndex = -1;
  renderInspector();
  let res;
  try {
    res = await getYdd(item.drawable);
  } catch (err) {
    if (token !== state.token) return;
    addProblem(item.drawable.path, err.message);
    disposeModel();
    el.tape.hidden = true;
    state.drawable = null;
    showOverlay(`<h2>Couldn't read this model</h2><p>${esc(err.message)}</p><code>${esc(item.drawable.path)}</code>`, true);
    renderInspector();
    return;
  }
  if (token !== state.token) return;
  state.drawables = res.drawables;
  state.drawableIndex = 0;
  if (!res.drawables.length) {
    disposeModel();
    showOverlay('<h2>This file has no drawables</h2><p>The dictionary is empty.</p>', true);
    renderInspector();
    return;
  }
  showDrawable(0, item, token);
}

function showDrawable(index, item, token) {
  const drawable = state.drawables[index];
  state.drawableIndex = index;
  state.drawable = drawable;
  if (!drawable.lods[state.lod]) state.lod = ['high', 'med', 'low', 'vlow'].find((l) => drawable.lods[l]) || 'high';
  setTexture(null);
  buildModel(drawable, state.lod);
  if (!modelGroup.children.length) showOverlay('<h2>No geometry at this level of detail</h2><p>Try another LOD.</p>');
  frameModel();
  updateLodButtons();

  // Variants: matched .ytd files first, then textures embedded in the drawable itself.
  state.variants = item.textures.map((entry) => ({ key: entry.path, label: textureLabel(entry.info), entry, status: 'loading' }));
  for (const t of drawable.embeddedTextures) {
    state.variants.push({ key: `embedded:${t.name}`, label: `${t.name} (embedded)`, texture: t, status: 'loading' });
  }
  renderInspector();
  if (state.variants.length) {
    const wanted = drawable.shaders.find((s) => s?.diffuseName)?.diffuseName?.toLowerCase();
    let first = state.variants.findIndex((v) => (v.entry?.info.name || v.texture?.name || '').toLowerCase() === wanted);
    if (first < 0) first = 0;
    applyVariant(first, token);
  }
  loadThumbs(token);
}

async function resolveVariant(v) {
  if (v.texture) return v.texture;
  const res = await getYtd(v.entry);
  const t = pickTexture(res.textures, v.entry);
  if (!t) throw new Error('The texture dictionary is empty.');
  v.texture = t;
  v.count = res.textures.length;
  return t;
}

async function loadThumbs(token) {
  for (const v of state.variants) {
    if (token !== state.token) return;
    try {
      const t = await resolveVariant(v);
      if (!t.supported) throw new Error(`Unsupported format ${t.formatName}`);
      v.thumb = thumbOf(rgbaOf(t), t.width, t.height);
      v.status = 'ok';
    } catch (err) {
      v.status = 'failed';
      v.error = err.message;
      if (v.entry) addProblem(v.entry.path, err.message);
    }
    if (token === state.token) renderVariants();
    await new Promise((r) => setTimeout(r, 0)); // keep the UI responsive between decodes
  }
}

async function applyVariant(index, token = state.token) {
  const v = state.variants[index];
  if (!v) return;
  state.variantIndex = index;
  renderVariants();
  try {
    const t = await resolveVariant(v);
    if (token !== state.token || state.variantIndex !== index) return;
    setTexture(rgbaOf(t), t.width, t.height);
    const png = el.inspect.querySelector('[data-act="png"]');
    if (png) png.disabled = false;
  } catch (err) {
    if (token !== state.token) return;
    v.status = 'failed';
    v.error = err.message;
    setTexture(null);
    toast(`Texture failed: ${err.message}`);
  }
  renderTextureDetail();
}

async function selectLoose(entry, token) {
  disposeModel();
  el.tape.hidden = true;
  hideOverlay();
  state.drawable = null;
  state.variants = [];
  renderInspector();
  try {
    const res = await getYtd(entry);
    if (token !== state.token) return;
    const t = pickTexture(res.textures, entry);
    if (!t) throw new Error('The texture dictionary is empty.');
    state.variants = [{ key: entry.path, label: entry.info.name, entry, texture: t, status: 'ok' }];
    state.variantIndex = 0;
    showFlat(rgbaToCanvas(rgbaOf(t), t.width, t.height));
  } catch (err) {
    if (token !== state.token) return;
    addProblem(entry.path, err.message);
    showFlat(null);
    showOverlay(`<h2>Couldn't read this texture</h2><p>${esc(err.message)}</p><code>${esc(entry.path)}</code>`, true);
  }
  renderInspector();
}

// ---------------------------------------------------------------- inspector

function renderInspector() {
  const row = state.selected;
  if (!row) {
    el.inspect.innerHTML = `<section><span class="label">Inspector</span><p class="muted">Pick a model on the left to see its geometry, texture variants and export options.</p></section>${problemsHtml()}`;
    return;
  }
  if (row.type === 'loose') {
    const v = state.variants[0];
    el.inspect.innerHTML = `<section class="title"><span class="tag">Texture</span><h2>${esc(row.ref.info.name)}</h2><div class="path">${esc(row.ref.path)}</div></section>`
      + `<section id="tex-detail"></section>`
      + (v && !NO_EXPORT ? `<section><div class="row"><button class="btn" type="button" data-act="png">Export PNG</button></div></section>` : '')
      + problemsHtml();
    renderTextureDetail();
    return;
  }
  const item = row.ref;
  const d = state.drawable;
  const info = item.drawable.info;
  const slot = slotInfo(info.slot);
  let stats = '';
  if (d) {
    const s = drawableStats(d, state.lod);
    const g = d.lods[state.lod]?.[0]?.geometries[0];
    const layout = g ? `${g.stride} B/vertex` : '-';
    stats = `<dl class="stats">
      <dt>Vertices</dt><dd>${fmt(s.vertices)}</dd>
      <dt>Triangles</dt><dd>${fmt(s.triangles)}</dd>
      <dt>Geometries</dt><dd>${s.geometries}</dd>
      <dt>Vertex size</dt><dd>${layout}</dd>
      <dt>Shaders</dt><dd>${d.shaders.length}</dd>
      <dt>Diffuse ref</dt><dd>${esc(d.shaders.find((x) => x?.diffuseName)?.diffuseName || '-')}</dd>
    </dl>`;
    if (state.drawables.length > 1) {
      stats += `<div class="field"><label for="drawable-pick">Drawable in this file</label><select id="drawable-pick">${state.drawables
        .map((x, i) => `<option value="${i}"${i === state.drawableIndex ? ' selected' : ''}>${esc(x.name || `#${i + 1}`)}</option>`).join('')}</select></div>`;
    }
  }
  const others = state.catalog.allTextures;
  el.inspect.innerHTML = `
    <section class="title">
      <span class="tag">${esc(slot.label)}${slot.id !== undefined ? ` · component ${slot.id}` : ''}</span>
      <h2>${esc(item.name)}</h2>
      <div class="path">${esc(item.drawable.path)}</div>
    </section>
    <section>${stats || '<p class="muted">Reading…</p>'}</section>
    <section>
      <div class="pane-head" style="padding:0;border:0"><span class="label">Texture variants</span><span class="label">${state.variants.length}</span></div>
      <div class="variants" id="variants"></div>
      <div class="field"><label for="any-texture">Try any loaded texture</label>
        <select id="any-texture"><option value="">Choose a .ytd…</option>${others.map((t) => `<option value="${esc(t.path)}">${esc(t.info.name)}</option>`).join('')}</select>
      </div>
    </section>
    <section id="tex-detail"></section>
    ${NO_EXPORT ? `<section><span class="label">Export</span><p class="muted">Exports are turned off in the hosted copy. Use the downloaded <code>seamline.html</code> to save models and textures.</p></section>` : `<section>
      <span class="label">Export</span>
      <div class="row">
        <button class="btn" type="button" data-act="glb"${d ? '' : ' disabled'}>Model .glb</button>
        <button class="btn" type="button" data-act="png"${state.variantIndex >= 0 ? '' : ' disabled'}>Texture .png</button>
        <button class="btn" type="button" data-act="shot"${d ? '' : ' disabled'}>Screenshot</button>
      </div>
    </section>`}
    ${problemsHtml()}`;
  renderVariants();
  renderTextureDetail();
}

function renderVariants() {
  const box = document.getElementById('variants');
  if (!box) return;
  if (!state.variants.length) {
    box.outerHTML = '<p class="muted" id="variants">No texture found for this model. Textures pair by name: <code>…_diff_NNN_a_uni.ytd</code>. You can still try any loaded texture below.</p>';
    return;
  }
  box.innerHTML = state.variants.map((v, i) => {
    const thumb = v.status === 'ok' && v.thumb
      ? `<img class="thumb" src="${v.thumb}" alt="">`
      : `<span class="thumb">${v.status === 'failed' ? 'failed' : ''}</span>`;
    const [main, sub] = v.label.split(' · ');
    return `<button class="variant${v.status === 'failed' ? ' failed' : ''}" type="button" data-variant="${i}" aria-pressed="${i === state.variantIndex}" title="${esc(v.error || v.entry?.path || v.label)}">${thumb}<span class="vl"><b>${esc(main)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`;
  }).join('');
}

function renderTextureDetail() {
  const box = document.getElementById('tex-detail');
  if (!box) return;
  const v = state.variants[state.variantIndex];
  if (!v || !v.texture) { box.hidden = true; return; }
  box.hidden = false;
  const t = v.texture;
  box.innerHTML = `<span class="label">Texture</span><dl class="stats">
    <dt>Name</dt><dd>${esc(t.name)}</dd>
    <dt>Size</dt><dd>${t.width} × ${t.height}</dd>
    <dt>Format</dt><dd>${esc(t.formatName)}</dd>
    <dt>Mip levels</dt><dd>${t.levels}</dd>
    ${v.count > 1 ? `<dt>In this .ytd</dt><dd>${v.count} textures</dd>` : ''}
    ${v.error ? `<dt>Problem</dt><dd>${esc(v.error)}</dd>` : ''}
  </dl>`;
}

function problemsHtml() {
  if (!state.problems.length) return '';
  return `<section><span class="label">Files that couldn't be read (${state.problems.length})</span><div class="problems">${state.problems
    .slice(-30).reverse().map((p) => `<div class="problem"><b>${esc(p.path)}</b>${esc(p.message)}</div>`).join('')}</div></section>`;
}

el.inspect.addEventListener('click', (e) => {
  const v = e.target.closest('[data-variant]');
  if (v) { applyVariant(+v.dataset.variant); return; }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'png') exportPng();
  if (act === 'glb') exportGlb();
  if (act === 'shot') exportShot();
});
el.inspect.addEventListener('change', async (e) => {
  if (e.target.id === 'drawable-pick') {
    showDrawable(+e.target.value, state.selected.ref, state.token);
  }
  if (e.target.id === 'any-texture' && e.target.value) {
    const entry = state.catalog.allTextures.find((t) => t.path === e.target.value);
    if (!entry) return;
    let i = state.variants.findIndex((v) => v.key === entry.path);
    if (i < 0) {
      state.variants.push({ key: entry.path, label: entry.info.name, entry, status: 'loading' });
      i = state.variants.length - 1;
      const v = state.variants[i];
      resolveVariant(v).then((t) => { v.thumb = thumbOf(rgbaOf(t), t.width, t.height); v.status = 'ok'; renderVariants(); })
        .catch((err) => { v.status = 'failed'; v.error = err.message; renderVariants(); });
    }
    applyVariant(i);
  }
});

// ---------------------------------------------------------------- toolbar

function updateLodButtons() {
  document.querySelectorAll('[data-lod]').forEach((b) => {
    b.disabled = !state.drawable?.lods[b.dataset.lod];
    b.setAttribute('aria-pressed', String(b.dataset.lod === state.lod));
  });
}
$('lod-group').addEventListener('click', (e) => {
  const b = e.target.closest('[data-lod]');
  if (!b || b.disabled || !state.drawable) return;
  state.lod = b.dataset.lod;
  buildModel(state.drawable, state.lod); // new materials pick up currentTexture
  frameModel(true);
  updateLodButtons();
  renderInspector();
});
function toggle(id, keyName, after) {
  const b = $(id);
  b.setAttribute('aria-pressed', String(state[keyName]));
  b.addEventListener('click', () => {
    state[keyName] = !state[keyName];
    b.setAttribute('aria-pressed', String(state[keyName]));
    after();
    requestRender();
  });
}
toggle('t-wire', 'wire', () => { for (const m of materials.values()) m.wireframe = state.wire; });
toggle('t-alpha', 'alpha', () => { store('alpha', state.alpha); for (const m of materials.values()) { m.alphaTest = state.alpha ? 0.4 : 0; m.needsUpdate = true; } });
toggle('t-grid', 'grid', () => { store('grid', state.grid); gridGroup.visible = state.grid; });
toggle('t-spin', 'spin', () => { controls.autoRotate = state.spin; });
$('reset-view').addEventListener('click', () => frameModel());

// ---------------------------------------------------------------- export

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast(`Saved ${name}`);
}
function exportPng() {
  const v = state.variants[state.variantIndex];
  if (!v?.texture) return;
  const t = v.texture;
  rgbaToCanvas(rgbaOf(t), t.width, t.height).toBlob((b) => download(b, `${t.name || 'texture'}.png`), 'image/png');
}
function exportGlb() {
  if (!modelGroup) return;
  const name = state.drawable?.name || 'model';
  new GLTFExporter().parse(root, (glb) => download(new Blob([glb], { type: 'model/gltf-binary' }), `${name}.glb`),
    (err) => toast(`Export failed: ${err.message || err}`), { binary: true, onlyVisible: true });
}
function exportShot() {
  renderer.render(scene, camera);
  el.gl.toBlob((b) => download(b, `${state.drawable?.name || 'screenshot'}.png`), 'image/png');
}

// ---------------------------------------------------------------- keyboard

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
  const rows = state.visible;
  const cur = rows.findIndex((r) => r.ref === state.selected?.ref);
  if ((e.key === 'ArrowDown' || e.key === 'j') && rows.length) {
    e.preventDefault();
    select(rows[Math.min(rows.length - 1, cur + 1)]);
  } else if ((e.key === 'ArrowUp' || e.key === 'k') && rows.length) {
    e.preventDefault();
    select(rows[Math.max(0, cur - 1)]);
  } else if ((e.key === 'ArrowRight' || e.key === 'l') && state.variants.length > 1 && state.selected?.type === 'item') {
    e.preventDefault();
    applyVariant((state.variantIndex + 1) % state.variants.length);
  } else if ((e.key === 'ArrowLeft' || e.key === 'h') && state.variants.length > 1 && state.selected?.type === 'item') {
    e.preventDefault();
    applyVariant((state.variantIndex - 1 + state.variants.length) % state.variants.length);
  } else if (e.key === '/') {
    e.preventDefault();
    el.search.focus();
  }
});

// ---------------------------------------------------------------- loading

function setEntries(entries, label) {
  yddCache.clear();
  ytdCache.clear();
  state.entries = entries;
  state.catalog = buildCatalog(entries);
  state.problems = [];
  state.selected = null;
  state.drawable = null;
  const models = state.catalog.collections.reduce((n, c) => n + c.slots.reduce((m, s) => m + s.items.length, 0), 0);
  const textures = state.catalog.allTextures.length;
  el.summary.textContent = `${label} · ${fmt(models)} models · ${fmt(textures)} textures`;
  el.fileCount.textContent = fmt(models + textures);
  renderTree();
  renderInspector();
  if (state.visible.length) {
    select(state.visible[0]);
  } else {
    disposeModel();
    el.tape.hidden = true;
    showFlat(null);
    showOverlay(entries.length
      ? '<h2>No .ydd or .ytd files found</h2><p>Open the <b>stream</b> folder of a clothing resource, or the folder above it.</p>'
      : '<h2>Open a stream folder to begin</h2><p>Or drop it anywhere on this page.</p>');
  }
}

function fromFileList(list) {
  return [...list]
    .filter((f) => /\.(ydd|ytd)$/i.test(f.name))
    .map((f) => ({ path: f.webkitRelativePath || f.name, file: f }));
}

$('open-folder').addEventListener('click', () => el.folderInput.click());
$('open-files').addEventListener('click', () => el.filesInput.click());
el.folderInput.addEventListener('change', () => {
  const entries = fromFileList(el.folderInput.files);
  const top = el.folderInput.files[0]?.webkitRelativePath?.split('/')[0] || 'Folder';
  setEntries(entries, top);
  el.folderInput.value = '';
});
el.filesInput.addEventListener('change', () => {
  setEntries(fromFileList(el.filesInput.files), `${el.filesInput.files.length} files`);
  el.filesInput.value = '';
});
$('load-demo').addEventListener('click', loadDemo);

async function loadDemo() {
  try {
    setEntries(await buildDemoEntries(), 'Demo files (generated)');
  } catch (err) {
    showOverlay(`<h2>Couldn't build the demo</h2><p>${esc(err.message)}</p>`, true);
  }
}

// Drag and drop, including whole folders.
async function walkEntry(entry, prefix, out) {
  if (entry.isFile) {
    if (/\.(ydd|ytd)$/i.test(entry.name)) {
      const file = await new Promise((res, rej) => entry.file(res, rej));
      out.push({ path: prefix + entry.name, file });
    }
    return;
  }
  if (entry.isDirectory) {
    const reader = entry.createReader();
    for (;;) {
      const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
      if (!batch.length) break;
      for (const child of batch) await walkEntry(child, `${prefix}${entry.name}/`, out);
    }
  }
}
let dragDepth = 0;
window.addEventListener('dragenter', (e) => { if (e.dataTransfer?.types.includes('Files')) { dragDepth++; el.drop.hidden = false; } });
window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) el.drop.hidden = true; });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragDepth = 0;
  el.drop.hidden = true;
  const items = [...(e.dataTransfer?.items || [])];
  const roots = items.map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
  let entries = [];
  if (roots.length) {
    showOverlay('<h2>Reading folder…</h2>');
    for (const r of roots) await walkEntry(r, '', entries);
    hideOverlay();
  } else {
    entries = fromFileList(e.dataTransfer.files);
  }
  const label = roots.length === 1 ? roots[0].name : `${entries.length} files`;
  setEntries(entries, label);
});

// ---------------------------------------------------------------- start

applyTheme();
resize();
loop();
renderTree();
renderInspector();
loadDemo();
