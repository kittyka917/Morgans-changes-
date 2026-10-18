// RAGE "RSC7" resource container, as used by loose .ydd / .ytd files.
//
// Layout (from CodeWalker: RpfFile.CreateResourceFileEntry, ResourceBuilder,
// ResourceDataReader):
//   0x00 u32 magic 'RSC7' (0x37435352)
//   0x04 u32 version   (ytd: 13, ydd: 165 for legacy / FiveM; gen9 uses 5 / 159)
//   0x08 u32 system page flags
//   0x0C u32 graphics page flags
//   0x10 ... raw DEFLATE stream (no zlib header)
// Decompressed data = system segment followed by graphics segment. Pointers
// inside the data are 0x5XXXXXXX (system) or 0x6XXXXXXX (graphics).

export const RSC7_MAGIC = 0x37435352;

export class ResourceError extends Error {}

// rage page-flag size decoding (CodeWalker RpfResourceFileEntry.GetSizeFromFlags).
export function sizeFromFlags(flags) {
  const s0 = ((flags >>> 27) & 0x1) << 0;
  const s1 = ((flags >>> 26) & 0x1) << 1;
  const s2 = ((flags >>> 25) & 0x1) << 2;
  const s3 = ((flags >>> 24) & 0x1) << 3;
  const s4 = ((flags >>> 17) & 0x7f) << 4;
  const s5 = ((flags >>> 11) & 0x3f) << 5;
  const s6 = ((flags >>> 7) & 0xf) << 6;
  const s7 = ((flags >>> 5) & 0x3) << 7;
  const s8 = ((flags >>> 4) & 0x1) << 8;
  const ss = flags & 0xf;
  return (0x200 << ss) * (s0 + s1 + s2 + s3 + s4 + s5 + s6 + s7 + s8);
}

export async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Parses the header and decompresses. `bytes` is the whole file as a Uint8Array.
export async function openResource(bytes) {
  if (bytes.length < 16) throw new ResourceError('File is too small to be a resource.');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = dv.getUint32(0, true);
  if (magic !== RSC7_MAGIC) {
    const tag = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]).replace(/[^\x20-\x7e]/g, '?');
    if (tag === 'RSC8') throw new ResourceError('This is a GTA V Enhanced (gen9) resource, which FiveM does not use. Not supported.');
    throw new ResourceError(`Not an RSC7 resource (header "${tag}"). It may be encrypted (e.g. FiveM escrow) or not a GTA resource.`);
  }
  const version = dv.getUint32(4, true);
  const systemFlags = dv.getUint32(8, true);
  const graphicsFlags = dv.getUint32(12, true);

  let data;
  try {
    data = await inflateRaw(bytes.subarray(16));
  } catch (e) {
    throw new ResourceError(`Could not decompress resource data (${e.message}). The file may be encrypted or corrupt.`);
  }

  let systemSize = sizeFromFlags(systemFlags);
  let graphicsSize = sizeFromFlags(graphicsFlags);
  if (systemSize > data.length) systemSize = data.length;
  if (systemSize + graphicsSize > data.length) graphicsSize = data.length - systemSize;

  return {
    version,
    systemFlags,
    graphicsFlags,
    systemSize,
    graphicsSize,
    data,
    reader: new ResourceReader(data, systemSize, graphicsSize),
  };
}

// Random-access reader over the decompressed segments. All "off" arguments
// are absolute offsets into `data`; `ptr()` turns a resource pointer into one.
export class ResourceReader {
  constructor(data, systemSize, graphicsSize) {
    this.data = data;
    this.systemSize = systemSize;
    this.graphicsSize = graphicsSize;
    this.dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  check(off, len) {
    if (off < 0 || off + len > this.data.length) {
      throw new ResourceError(`Read out of range at 0x${off.toString(16)} (+${len}); file may be malformed.`);
    }
  }

  u8(off) { this.check(off, 1); return this.data[off]; }
  u16(off) { this.check(off, 2); return this.dv.getUint16(off, true); }
  u32(off) { this.check(off, 4); return this.dv.getUint32(off, true); }
  f32(off) { this.check(off, 4); return this.dv.getFloat32(off, true); }

  // Reads a u64 pointer at `off` and resolves it. Returns -1 for null.
  ptrAt(off) {
    const lo = this.u32(off);
    const hi = this.u32(off + 4);
    if (lo === 0 && hi === 0) return -1;
    if (hi !== 0) throw new ResourceError(`Invalid pointer 0x${hi.toString(16)}${lo.toString(16).padStart(8, '0')} at 0x${off.toString(16)}.`);
    return this.resolve(lo);
  }

  resolve(p) {
    const seg = p >>> 28;
    const rel = p & 0x0fffffff;
    if (seg === 5) {
      if (rel >= this.systemSize) throw new ResourceError(`System pointer 0x${p.toString(16)} is outside the system segment.`);
      return rel;
    }
    if (seg === 6) {
      if (rel >= this.graphicsSize) throw new ResourceError(`Graphics pointer 0x${p.toString(16)} is outside the graphics segment.`);
      return this.systemSize + rel;
    }
    throw new ResourceError(`Invalid pointer 0x${p.toString(16)}.`);
  }

  bytes(off, len) { this.check(off, len); return this.data.subarray(off, off + len); }

  // Null-terminated string at an absolute offset (or null for -1).
  string(off) {
    if (off < 0) return null;
    let end = off;
    while (end < this.data.length && this.data[end] !== 0) end++;
    let s = '';
    for (let i = off; i < end; i++) s += String.fromCharCode(this.data[i]);
    return s;
  }

  // rage list header: { u64 pointer, u16 count, u16 capacity, u32 pad }.
  listAt(off) {
    return { ptr: this.ptrAt(off), count: this.u16(off + 8), capacity: this.u16(off + 10) };
  }

  u32Array(off, count) {
    const out = new Array(count);
    for (let i = 0; i < count; i++) out[i] = this.u32(off + i * 4);
    return out;
  }

  // Array of `count` u64 pointers, resolved (-1 for null entries).
  ptrArray(off, count) {
    const out = new Array(count);
    for (let i = 0; i < count; i++) out[i] = this.ptrAt(off + i * 8);
    return out;
  }
}

// Jenkins one-at-a-time hash ("joaat"), as used for GTA V names. Lower-cases first.
export function joaat(str) {
  const s = str.toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h + s.charCodeAt(i)) >>> 0;
    h = (h + (h << 10)) >>> 0;
    h = (h ^ (h >>> 6)) >>> 0;
  }
  h = (h + (h << 3)) >>> 0;
  h = (h ^ (h >>> 11)) >>> 0;
  h = (h + (h << 15)) >>> 0;
  return h;
}
