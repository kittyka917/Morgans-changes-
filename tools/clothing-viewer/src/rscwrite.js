// Writes minimal legacy .ytd / .ydd resources, laid out the way CodeWalker
// writes them. Used for the built-in demo files and for the tests.

const SYS = 0x50000000, GFX = 0x60000000;

class Segment {
  constructor(base) { this.base = base; this.buf = new Uint8Array(1 << 16); this.len = 0; this.dv = new DataView(this.buf.buffer); }
  alloc(size, align = 16) {
    this.len = Math.ceil(this.len / align) * align;
    const off = this.len;
    this.len += size;
    if (this.len > this.buf.length) {
      const nb = new Uint8Array(Math.max(this.len, this.buf.length * 2));
      nb.set(this.buf);
      this.buf = nb;
      this.dv = new DataView(nb.buffer);
    }
    return off;
  }
  ptr(off) { return this.base + off; }
  u8(o, v) { this.dv.setUint8(o, v); }
  u16(o, v) { this.dv.setUint16(o, v, true); }
  u32(o, v) { this.dv.setUint32(o, v >>> 0, true); }
  f32(o, v) { this.dv.setFloat32(o, v, true); }
  p64(o, p) { this.dv.setUint32(o, p >>> 0, true); this.dv.setUint32(o + 4, 0, true); }
  bytes(o, b) { this.buf.set(b, o); }
  str(s) { const o = this.alloc(s.length + 1); for (let i = 0; i < s.length; i++) this.buf[o + i] = s.charCodeAt(i); return o; }
  list(o, p, count) { this.p64(o, p); this.u16(o + 8, count); this.u16(o + 10, count); }
}

// Page flags using only the x16 pages field (size shift 0): size = 0x2000 * n, n <= 127.
function flagsFor(size, versionNibble) {
  let n = Math.ceil(size / 0x2000);
  let shift = 0;
  while (n > 127) { shift++; n = Math.ceil(size / (0x2000 << shift)); }
  return ((versionNibble & 0xf) << 28 | (n << 17) | shift) >>> 0;
}
function paddedSize(size) {
  if (size === 0) return 0;
  let shift = 0;
  while (Math.ceil(size / (0x2000 << shift)) > 127) shift++;
  return Math.ceil(size / (0x2000 << shift)) * (0x2000 << shift);
}

async function deflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function pack(sys, gfx, version) {
  const sysSize = paddedSize(sys.len) || 0x2000;
  const gfxSize = paddedSize(gfx.len);
  const body = new Uint8Array(sysSize + gfxSize);
  body.set(sys.buf.subarray(0, sys.len), 0);
  body.set(gfx.buf.subarray(0, gfx.len), sysSize);
  const comp = await deflateRaw(body);
  const out = new Uint8Array(16 + comp.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x37435352, true);
  dv.setUint32(4, version, true);
  dv.setUint32(8, flagsFor(sysSize, version >> 4), true);
  dv.setUint32(12, flagsFor(gfxSize, version & 0xf), true);
  out.set(comp, 16);
  return out;
}

// TextureBase + Texture (0x90 bytes).
function writeTexture(sys, gfx, { name, width, height, format, stride, levels = 1, pixels }) {
  const t = sys.alloc(0x90);
  sys.u32(t + 0x04, 1);
  sys.p64(t + 0x28, sys.ptr(sys.str(name)));
  sys.u16(t + 0x30, 1);
  sys.u16(t + 0x50, width);
  sys.u16(t + 0x52, height);
  sys.u16(t + 0x54, 1);
  sys.u16(t + 0x56, stride);
  sys.u32(t + 0x58, format);
  sys.u8(t + 0x5d, levels);
  if (pixels) {
    const d = gfx.alloc(pixels.length);
    gfx.bytes(d, pixels);
    sys.p64(t + 0x70, gfx.ptr(d));
  }
  return t;
}

function writeTextureDictionary(sys, gfx, textures, at) {
  const td = at ?? sys.alloc(64);
  sys.u32(td + 0x18, 1);
  const hashes = sys.alloc(textures.length * 4);
  textures.forEach((t, i) => sys.u32(hashes + i * 4, t.hash ?? i));
  const ptrs = sys.alloc(textures.length * 8);
  textures.forEach((t, i) => sys.p64(ptrs + i * 8, sys.ptr(writeTexture(sys, gfx, t))));
  sys.list(td + 0x20, sys.ptr(hashes), textures.length);
  sys.list(td + 0x30, sys.ptr(ptrs), textures.length);
  return td;
}

// textures: [{ name, width, height, format, stride, pixels, hash? }]
export async function writeYtd(textures) {
  const sys = new Segment(SYS), gfx = new Segment(GFX);
  sys.alloc(64);
  writeTextureDictionary(sys, gfx, textures, 0);
  return pack(sys, gfx, 13);
}

function floatToHalf(f) {
  const dv = new DataView(new ArrayBuffer(4));
  dv.setFloat32(0, f);
  const x = dv.getUint32(0);
  const sign = (x >>> 16) & 0x8000;
  const exp = ((x >>> 23) & 0xff) - 127 + 15;
  if (exp <= 0) return sign;
  if (exp >= 31) return sign | 0x7c00;
  return sign | (exp << 10) | ((x >>> 13) & 0x3ff);
}

// Vertex layouts:
//   'gtav1':  Float3 position, Float3 normal, Float2 uv0                (types 0x7755555555996996)
//   'packed': Float3 position, RGBA8SNorm normal, Colour0, Half2 uv0    (types 0x030000000199A006)
const LAYOUTS = {
  gtav1: { flags: 0b1001001, lo: 0x55996996, hi: 0x77555555, stride: 32, count: 3 },
  packed: { flags: 0b1011001, lo: 0x0199a006, hi: 0x03000000, stride: 24, count: 4 },
};

// geometry: { positions: number[] (xyz), normals: number[] (xyz), uvs: number[] (uv), indices: number[] }
function writeGeometry(sys, gfx, geom, layout) {
  const L = LAYOUTS[layout];
  const count = geom.positions.length / 3;
  const decl = sys.alloc(16);
  sys.u32(decl, L.flags);
  sys.u16(decl + 4, L.stride);
  sys.u8(decl + 7, L.count);
  sys.u32(decl + 8, L.lo);
  sys.u32(decl + 12, L.hi);

  const vdata = gfx.alloc(L.stride * count);
  for (let v = 0; v < count; v++) {
    const o = vdata + v * L.stride;
    gfx.f32(o, geom.positions[v * 3]); gfx.f32(o + 4, geom.positions[v * 3 + 1]); gfx.f32(o + 8, geom.positions[v * 3 + 2]);
    const n = [geom.normals[v * 3], geom.normals[v * 3 + 1], geom.normals[v * 3 + 2]];
    const uv = [geom.uvs[v * 2], geom.uvs[v * 2 + 1]];
    if (layout === 'packed') {
      n.forEach((c, i) => gfx.u8(o + 12 + i, Math.round(c * 127) & 0xff));
      gfx.u8(o + 15, 0);
      gfx.u32(o + 16, 0xffffffff);
      gfx.u16(o + 20, floatToHalf(uv[0])); gfx.u16(o + 22, floatToHalf(uv[1]));
    } else {
      gfx.f32(o + 12, n[0]); gfx.f32(o + 16, n[1]); gfx.f32(o + 20, n[2]);
      gfx.f32(o + 24, uv[0]); gfx.f32(o + 28, uv[1]);
    }
  }

  const vb = sys.alloc(128);
  sys.u32(vb + 0x04, 1);
  sys.u16(vb + 0x08, L.stride);
  sys.p64(vb + 0x10, gfx.ptr(vdata));
  sys.u32(vb + 0x18, count);
  sys.p64(vb + 0x20, gfx.ptr(vdata));
  sys.p64(vb + 0x30, sys.ptr(decl));

  const idata = gfx.alloc(geom.indices.length * 2);
  geom.indices.forEach((v, i) => gfx.u16(idata + i * 2, v));
  const ib = sys.alloc(96);
  sys.u32(ib + 0x08, geom.indices.length);
  sys.p64(ib + 0x10, gfx.ptr(idata));

  const g = sys.alloc(0x98);
  sys.u32(g + 0x04, 1);
  sys.p64(g + 0x18, sys.ptr(vb));
  sys.p64(g + 0x38, sys.ptr(ib));
  sys.u32(g + 0x58, geom.indices.length);
  sys.u32(g + 0x5c, geom.indices.length / 3);
  sys.u16(g + 0x60, count);
  sys.u16(g + 0x62, 3);
  sys.u16(g + 0x70, L.stride);
  return g;
}

function writeModel(sys, gfx, geometries, layout) {
  const geoms = sys.alloc(geometries.length * 8);
  geometries.forEach((g, i) => sys.p64(geoms + i * 8, sys.ptr(writeGeometry(sys, gfx, g, layout))));
  const map = sys.alloc(geometries.length * 2);
  geometries.forEach((_, i) => sys.u16(map + i * 2, 0));
  const m = sys.alloc(0x30);
  sys.p64(m + 0x08, sys.ptr(geoms));
  sys.u16(m + 0x10, geometries.length);
  sys.u16(m + 0x12, geometries.length);
  sys.p64(m + 0x20, sys.ptr(map));
  return m;
}

// One shader with a DiffuseSampler texture parameter and one vector parameter.
function writeShaderGroup(sys, diffuseName) {
  const texRef = sys.alloc(0x50);
  sys.p64(texRef + 0x28, sys.ptr(sys.str(diffuseName)));
  const params = sys.alloc(2 * 16 + 16 + 2 * 4);
  sys.u8(params, 0);
  sys.p64(params + 8, sys.ptr(texRef));
  sys.u8(params + 16, 1);
  sys.p64(params + 24, sys.ptr(params + 32));
  sys.f32(params + 32, 1); sys.f32(params + 36, 1); sys.f32(params + 40, 1); sys.f32(params + 44, 1);
  sys.u32(params + 48, 4059966321); // joaat("diffusesampler")
  sys.u32(params + 52, 12345);
  const fx = sys.alloc(48);
  sys.p64(fx, sys.ptr(params));
  sys.u8(fx + 0x10, 2);
  const shaders = sys.alloc(8);
  sys.p64(shaders, sys.ptr(fx));
  const sg = sys.alloc(64);
  sys.p64(sg + 0x10, sys.ptr(shaders));
  sys.u16(sg + 0x18, 1);
  sys.u16(sg + 0x1a, 1);
  return sg;
}

// { name, hash, diffuseName, geometries, layout = 'gtav1' }
export async function writeYdd({ name, hash = 0, diffuseName, geometries, layout = 'gtav1' }) {
  const sys = new Segment(SYS), gfx = new Segment(GFX);
  const dict = sys.alloc(64);
  const d = sys.alloc(0xd0);
  const sg = writeShaderGroup(sys, diffuseName);
  const model = writeModel(sys, gfx, geometries, layout);
  const modelPtrs = sys.alloc(8);
  sys.p64(modelPtrs, sys.ptr(model));
  const listHdr = sys.alloc(16);
  sys.list(listHdr, sys.ptr(modelPtrs), 1);

  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const g of geometries) {
    for (let i = 0; i < g.positions.length; i++) {
      min[i % 3] = Math.min(min[i % 3], g.positions[i]);
      max[i % 3] = Math.max(max[i % 3], g.positions[i]);
    }
  }
  sys.p64(d + 0x10, sys.ptr(sg));
  min.forEach((v, i) => sys.f32(d + 0x30 + i * 4, v));
  max.forEach((v, i) => sys.f32(d + 0x40 + i * 4, v));
  sys.p64(d + 0x50, sys.ptr(listHdr));
  sys.p64(d + 0xa0, sys.ptr(listHdr));
  sys.p64(d + 0xa8, sys.ptr(sys.str(name)));

  const hashes = sys.alloc(4);
  sys.u32(hashes, hash);
  const ptrs = sys.alloc(8);
  sys.p64(ptrs, sys.ptr(d));
  sys.u32(dict + 0x18, 1);
  sys.list(dict + 0x20, sys.ptr(hashes), 1);
  sys.list(dict + 0x30, sys.ptr(ptrs), 1);
  return pack(sys, gfx, 165);
}
