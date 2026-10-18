// Texture decoding for GTA V (legacy / FiveM) texture formats.
//
// Block-compressed decoders (BC1-BC5, BC7) are a port of bcdec.h by Sergii
// Kudlai (MIT / Unlicense, https://github.com/iOrange/bcdec) and are tested
// bit-for-bit against it in test/bcn.test.mjs.

import { BC7_PARTITIONS_2, BC7_PARTITIONS_3 } from './bc7tables.js';

// D3DFMT values used by GTA V legacy textures (CodeWalker TextureFormat enum).
export const TextureFormat = {
  A8R8G8B8: 21,
  X8R8G8B8: 22,
  A1R5G5B5: 25,
  A8: 28,
  A8B8G8R8: 32,
  L8: 50,
  DXT1: 0x31545844,
  DXT3: 0x33545844,
  DXT5: 0x35545844,
  ATI1: 0x31495441,
  ATI2: 0x32495441,
  BC7: 0x20374342,
};

const FORMAT_NAMES = Object.fromEntries(Object.entries(TextureFormat).map(([k, v]) => [v, k]));

export function formatName(format) {
  return FORMAT_NAMES[format] || `unknown (0x${(format >>> 0).toString(16)})`;
}

// Bytes per 4x4 block for block formats, or bytes per pixel (negative) for linear.
function formatLayout(format) {
  switch (format) {
    case TextureFormat.DXT1:
    case TextureFormat.ATI1:
      return { block: 8 };
    case TextureFormat.DXT3:
    case TextureFormat.DXT5:
    case TextureFormat.ATI2:
    case TextureFormat.BC7:
      return { block: 16 };
    case TextureFormat.A8R8G8B8:
    case TextureFormat.X8R8G8B8:
    case TextureFormat.A8B8G8R8:
      return { bpp: 4 };
    case TextureFormat.A1R5G5B5:
      return { bpp: 2 };
    case TextureFormat.A8:
    case TextureFormat.L8:
      return { bpp: 1 };
    default:
      return null;
  }
}

export function isSupportedFormat(format) {
  return formatLayout(format) !== null;
}

// Size in bytes of mip level 0.
export function level0Size(format, width, height) {
  const layout = formatLayout(format);
  if (!layout) return 0;
  if (layout.block) return Math.max(1, (width + 3) >> 2) * Math.max(1, (height + 3) >> 2) * layout.block;
  return width * height * layout.bpp;
}

// ---- BC1-BC5 -------------------------------------------------------------

// Writes a 4x4 RGBA block into `out` (RGBA8, row pitch `pitch` bytes) at byte offset `o`.
function colorBlock(src, s, out, o, pitch, onlyOpaque) {
  const c0 = src[s] | (src[s + 1] << 8);
  const c1 = src[s + 2] | (src[s + 3] << 8);
  const r0 = (c0 >> 11) & 0x1f, g0 = (c0 >> 5) & 0x3f, b0 = c0 & 0x1f;
  const r1 = (c1 >> 11) & 0x1f, g1 = (c1 >> 5) & 0x3f, b1 = c1 & 0x1f;
  const ref = new Uint8Array(16);
  ref[0] = (r0 * 527 + 23) >> 6; ref[1] = (g0 * 259 + 33) >> 6; ref[2] = (b0 * 527 + 23) >> 6; ref[3] = 255;
  ref[4] = (r1 * 527 + 23) >> 6; ref[5] = (g1 * 259 + 33) >> 6; ref[6] = (b1 * 527 + 23) >> 6; ref[7] = 255;
  if (c0 > c1 || onlyOpaque) {
    ref[8] = ((2 * r0 + r1) * 351 + 61) >> 7;
    ref[9] = ((2 * g0 + g1) * 2763 + 1039) >> 11;
    ref[10] = ((2 * b0 + b1) * 351 + 61) >> 7;
    ref[11] = 255;
    ref[12] = ((r0 + r1 * 2) * 351 + 61) >> 7;
    ref[13] = ((g0 + g1 * 2) * 2763 + 1039) >> 11;
    ref[14] = ((b0 + b1 * 2) * 351 + 61) >> 7;
    ref[15] = 255;
  } else {
    ref[8] = ((r0 + r1) * 1053 + 125) >> 8;
    ref[9] = ((g0 + g1) * 4145 + 1019) >> 11;
    ref[10] = ((b0 + b1) * 1053 + 125) >> 8;
    ref[11] = 255;
    // ref[12..15] stay 0: transparent black
  }
  let idx = (src[s + 4] | (src[s + 5] << 8) | (src[s + 6] << 16) | (src[s + 7] << 24)) >>> 0;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const c = (idx & 3) * 4;
      const d = o + i * pitch + j * 4;
      out[d] = ref[c]; out[d + 1] = ref[c + 1]; out[d + 2] = ref[c + 2]; out[d + 3] = ref[c + 3];
      idx >>>= 2;
    }
  }
}

function sharpAlphaBlock(src, s, out, o, pitch) {
  for (let i = 0; i < 4; i++) {
    const alpha = src[s + i * 2] | (src[s + i * 2 + 1] << 8);
    for (let j = 0; j < 4; j++) out[o + i * pitch + j * 4] = ((alpha >> (4 * j)) & 0x0f) * 17;
  }
}

// Interpolated 8-bit channel block (BC3 alpha, BC4, BC5). Writes every `pixelSize` bytes.
function smoothAlphaBlock(src, s, out, o, pitch, pixelSize) {
  const a = new Uint8Array(8);
  a[0] = src[s];
  a[1] = src[s + 1];
  if (a[0] > a[1]) {
    a[2] = ((6 * a[0] + a[1]) / 7) | 0;
    a[3] = ((5 * a[0] + 2 * a[1]) / 7) | 0;
    a[4] = ((4 * a[0] + 3 * a[1]) / 7) | 0;
    a[5] = ((3 * a[0] + 4 * a[1]) / 7) | 0;
    a[6] = ((2 * a[0] + 5 * a[1]) / 7) | 0;
    a[7] = ((a[0] + 6 * a[1]) / 7) | 0;
  } else {
    a[2] = ((4 * a[0] + a[1]) / 5) | 0;
    a[3] = ((3 * a[0] + 2 * a[1]) / 5) | 0;
    a[4] = ((2 * a[0] + 3 * a[1]) / 5) | 0;
    a[5] = ((a[0] + 4 * a[1]) / 5) | 0;
    a[6] = 0;
    a[7] = 255;
  }
  // 48 bits of 3-bit indices: split into two 24-bit halves to stay in int range.
  let lo = src[s + 2] | (src[s + 3] << 8) | (src[s + 4] << 16);
  let hi = src[s + 5] | (src[s + 6] << 8) | (src[s + 7] << 16);
  for (let t = 0; t < 16; t++) {
    const i = t >> 2, j = t & 3;
    let v;
    if (t < 8) { v = lo & 7; lo >>= 3; } else { v = hi & 7; hi >>= 3; }
    out[o + i * pitch + j * pixelSize] = a[v];
  }
}

export function decodeBC1Block(src, s, out, o, pitch) { colorBlock(src, s, out, o, pitch, false); }
export function decodeBC2Block(src, s, out, o, pitch) {
  colorBlock(src, s + 8, out, o, pitch, true);
  sharpAlphaBlock(src, s, out, o + 3, pitch);
}
export function decodeBC3Block(src, s, out, o, pitch) {
  colorBlock(src, s + 8, out, o, pitch, true);
  smoothAlphaBlock(src, s, out, o + 3, pitch, 4);
}
// BC4 / BC5 write 1 or 2 bytes per pixel, matching bcdec's output layout.
export function decodeBC4Block(src, s, out, o, pitch) { smoothAlphaBlock(src, s, out, o, pitch, 1); }
export function decodeBC5Block(src, s, out, o, pitch) {
  smoothAlphaBlock(src, s, out, o, pitch, 2);
  smoothAlphaBlock(src, s + 8, out, o + 1, pitch, 2);
}

// ---- BC7 -----------------------------------------------------------------

const BC7_COLOR_BITS = [4, 6, 5, 7, 5, 7, 7, 5];
const BC7_ALPHA_BITS = [0, 0, 0, 0, 6, 8, 7, 5];
const BC7_W2 = [0, 21, 43, 64];
const BC7_W3 = [0, 9, 18, 27, 37, 46, 55, 64];
const BC7_W4 = [0, 4, 9, 13, 17, 21, 26, 30, 34, 38, 43, 47, 51, 55, 60, 64];
const BC7_HAS_PBITS = 0b11001011;

const interp = (a, b, w, i) => (a * (64 - w[i]) + b * w[i] + 32) >> 6;

export function decodeBC7Block(src, s, out, o, pitch) {
  const words = [
    (src[s] | (src[s + 1] << 8) | (src[s + 2] << 16) | (src[s + 3] << 24)) >>> 0,
    (src[s + 4] | (src[s + 5] << 8) | (src[s + 6] << 16) | (src[s + 7] << 24)) >>> 0,
    (src[s + 8] | (src[s + 9] << 8) | (src[s + 10] << 16) | (src[s + 11] << 24)) >>> 0,
    (src[s + 12] | (src[s + 13] << 8) | (src[s + 14] << 16) | (src[s + 15] << 24)) >>> 0,
    0,
  ];
  let pos = 0;
  const bits = (n) => {
    if (n === 0) return 0;
    const w = pos >>> 5, off = pos & 31;
    let v = words[w] >>> off;
    if (off + n > 32) v |= words[w + 1] << (32 - off);
    pos += n;
    return v & ((1 << n) - 1);
  };

  let mode = 0;
  while (mode < 8 && bits(1) === 0) mode++;
  if (mode >= 8) {
    for (let i = 0; i < 4; i++) out.fill(0, o + i * pitch, o + i * pitch + 16);
    return;
  }

  let partition = 0, numPartitions = 1, rotation = 0, indexSelection = 0;
  if (mode === 0 || mode === 1 || mode === 2 || mode === 3 || mode === 7) {
    numPartitions = mode === 0 || mode === 2 ? 3 : 2;
    partition = bits(mode === 0 ? 4 : 6);
  }
  const numEndpoints = numPartitions * 2;
  if (mode === 4 || mode === 5) {
    rotation = bits(2);
    if (mode === 4) indexSelection = bits(1);
  }

  const ep = [];
  for (let j = 0; j < numEndpoints; j++) ep.push([0, 0, 0, 0]);
  for (let c = 0; c < 3; c++) for (let j = 0; j < numEndpoints; j++) ep[j][c] = bits(BC7_COLOR_BITS[mode]);
  if (BC7_ALPHA_BITS[mode] > 0) for (let j = 0; j < numEndpoints; j++) ep[j][3] = bits(BC7_ALPHA_BITS[mode]);

  if (mode === 0 || mode === 1 || mode === 3 || mode === 6 || mode === 7) {
    for (let j = 0; j < numEndpoints; j++) for (let c = 0; c < 4; c++) ep[j][c] <<= 1;
    if (mode === 1) {
      const p0 = bits(1), p1 = bits(1);
      for (let c = 0; c < 3; c++) { ep[0][c] |= p0; ep[1][c] |= p0; ep[2][c] |= p1; ep[3][c] |= p1; }
    } else if (BC7_HAS_PBITS & (1 << mode)) {
      for (let j = 0; j < numEndpoints; j++) {
        const p = bits(1);
        for (let c = 0; c < 4; c++) ep[j][c] |= p;
      }
    }
  }

  const pbit = (BC7_HAS_PBITS >> mode) & 1;
  for (let j = 0; j < numEndpoints; j++) {
    let prec = BC7_COLOR_BITS[mode] + pbit;
    for (let c = 0; c < 3; c++) {
      ep[j][c] = (ep[j][c] << (8 - prec)) & 0xffff;
      ep[j][c] |= ep[j][c] >> prec;
    }
    prec = BC7_ALPHA_BITS[mode] + pbit;
    ep[j][3] = (ep[j][3] << (8 - prec)) & 0xffff;
    ep[j][3] |= ep[j][3] >> prec;
  }
  if (!BC7_ALPHA_BITS[mode]) for (let j = 0; j < numEndpoints; j++) ep[j][3] = 0xff;

  const indexBitsBase = mode === 0 || mode === 1 ? 3 : mode === 6 ? 4 : 2;
  const indexBits2 = mode === 4 ? 3 : mode === 5 ? 2 : 0;
  const weights = indexBitsBase === 2 ? BC7_W2 : indexBitsBase === 3 ? BC7_W3 : BC7_W4;
  const weights2 = indexBits2 === 2 ? BC7_W2 : BC7_W3;
  const table = numPartitions === 2 ? BC7_PARTITIONS_2 : BC7_PARTITIONS_3;
  const subsetAt = (t) => (numPartitions === 1 ? (t === 0 ? 128 : 0) : table[partition * 16 + t]);

  const indices = new Uint8Array(16);
  for (let t = 0; t < 16; t++) {
    let ib = indexBitsBase;
    if (subsetAt(t) & 0x80) ib--;
    indices[t] = bits(ib);
  }

  for (let t = 0; t < 16; t++) {
    const set = subsetAt(t) & 3;
    const e0 = ep[set * 2], e1 = ep[set * 2 + 1];
    const index = indices[t];
    let r, g, b, a;
    if (!indexBits2) {
      r = interp(e0[0], e1[0], weights, index);
      g = interp(e0[1], e1[1], weights, index);
      b = interp(e0[2], e1[2], weights, index);
      a = interp(e0[3], e1[3], weights, index);
    } else {
      const index2 = bits(t ? indexBits2 : indexBits2 - 1);
      if (!indexSelection) {
        r = interp(e0[0], e1[0], weights, index);
        g = interp(e0[1], e1[1], weights, index);
        b = interp(e0[2], e1[2], weights, index);
        a = interp(e0[3], e1[3], weights2, index2);
      } else {
        r = interp(e0[0], e1[0], weights2, index2);
        g = interp(e0[1], e1[1], weights2, index2);
        b = interp(e0[2], e1[2], weights2, index2);
        a = interp(e0[3], e1[3], weights, index);
      }
    }
    if (rotation === 1) [a, r] = [r, a];
    else if (rotation === 2) [a, g] = [g, a];
    else if (rotation === 3) [a, b] = [b, a];
    const d = o + (t >> 2) * pitch + (t & 3) * 4;
    out[d] = r; out[d + 1] = g; out[d + 2] = b; out[d + 3] = a;
  }
}

// ---- Whole-image decode --------------------------------------------------

// Decodes mip level 0 into a new RGBA8 Uint8Array of width*height*4 bytes.
// `data` holds the texture's pixel data starting at level 0.
// `stride` is the stored row pitch, used only for linear formats.
export function decodeToRGBA(format, width, height, data, stride = 0) {
  const layout = formatLayout(format);
  if (!layout) throw new Error(`Unsupported texture format ${formatName(format)}`);
  const out = new Uint8Array(width * height * 4);

  if (layout.block) {
    const bw = Math.max(1, (width + 3) >> 2), bh = Math.max(1, (height + 3) >> 2);
    // Decode into a block-aligned scratch image, then crop.
    const aw = bw * 4, ah = bh * 4;
    const pixelSize = format === TextureFormat.ATI1 ? 1 : format === TextureFormat.ATI2 ? 2 : 4;
    const scratch = new Uint8Array(aw * ah * pixelSize);
    const pitch = aw * pixelSize;
    const decode = {
      [TextureFormat.DXT1]: decodeBC1Block,
      [TextureFormat.DXT3]: decodeBC2Block,
      [TextureFormat.DXT5]: decodeBC3Block,
      [TextureFormat.ATI1]: decodeBC4Block,
      [TextureFormat.ATI2]: decodeBC5Block,
      [TextureFormat.BC7]: decodeBC7Block,
    }[format];
    const need = bw * bh * layout.block;
    if (data.length < need) throw new Error(`Texture data truncated: need ${need} bytes, have ${data.length}`);
    let s = 0;
    for (let by = 0; by < bh; by++) {
      for (let bx = 0; bx < bw; bx++) {
        decode(data, s, scratch, by * 4 * pitch + bx * 4 * pixelSize, pitch);
        s += layout.block;
      }
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const si = y * pitch + x * pixelSize, di = (y * width + x) * 4;
        if (pixelSize === 4) {
          out[di] = scratch[si]; out[di + 1] = scratch[si + 1]; out[di + 2] = scratch[si + 2]; out[di + 3] = scratch[si + 3];
        } else if (pixelSize === 1) {
          out[di] = out[di + 1] = out[di + 2] = scratch[si]; out[di + 3] = 255;
        } else {
          // BC5 is used for normal maps: rebuild Z so it reads as a normal map.
          const nx = scratch[si] / 127.5 - 1, ny = scratch[si + 1] / 127.5 - 1;
          const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
          out[di] = scratch[si]; out[di + 1] = scratch[si + 1]; out[di + 2] = Math.round((nz + 1) * 127.5); out[di + 3] = 255;
        }
      }
    }
    return out;
  }

  const rowBytes = width * layout.bpp;
  const pitch = stride >= rowBytes ? stride : rowBytes;
  if (data.length < pitch * (height - 1) + rowBytes) {
    throw new Error(`Texture data truncated: need ${pitch * height} bytes, have ${data.length}`);
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = y * pitch + x * layout.bpp, di = (y * width + x) * 4;
      switch (format) {
        case TextureFormat.A8R8G8B8: // memory order B G R A
          out[di] = data[si + 2]; out[di + 1] = data[si + 1]; out[di + 2] = data[si]; out[di + 3] = data[si + 3];
          break;
        case TextureFormat.X8R8G8B8:
          out[di] = data[si + 2]; out[di + 1] = data[si + 1]; out[di + 2] = data[si]; out[di + 3] = 255;
          break;
        case TextureFormat.A8B8G8R8: // memory order R G B A
          out[di] = data[si]; out[di + 1] = data[si + 1]; out[di + 2] = data[si + 2]; out[di + 3] = data[si + 3];
          break;
        case TextureFormat.A1R5G5B5: {
          const v = data[si] | (data[si + 1] << 8);
          out[di] = (((v >> 10) & 31) * 255 / 31) | 0;
          out[di + 1] = (((v >> 5) & 31) * 255 / 31) | 0;
          out[di + 2] = ((v & 31) * 255 / 31) | 0;
          out[di + 3] = v & 0x8000 ? 255 : 0;
          break;
        }
        case TextureFormat.A8:
          out[di] = out[di + 1] = out[di + 2] = 255; out[di + 3] = data[si];
          break;
        case TextureFormat.L8:
          out[di] = out[di + 1] = out[di + 2] = data[si]; out[di + 3] = 255;
          break;
      }
    }
  }
  return out;
}
