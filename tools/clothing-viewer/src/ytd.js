// Texture dictionaries (.ytd, and the dictionary embedded in a drawable's shader group).
// Struct offsets follow CodeWalker's legacy (non-gen9) TextureDictionary / TextureBase / Texture.

import { openResource, ResourceError } from './rsc.js';
import { decodeToRGBA, level0Size, isSupportedFormat, formatName } from './bcn.js';

export const YTD_VERSION = 13;
const YTD_VERSION_GEN9 = 5;

// TextureDictionary (64 bytes):
//   0x00 ResourceFileBase (16)   0x10..0x1F unknowns
//   0x20 list64<u32> name hashes 0x30 list64<Texture*> textures
export function readTextureDictionary(reader, off) {
  const hashes = reader.listAt(off + 0x20);
  const textures = reader.listAt(off + 0x30);
  const hashValues = hashes.ptr >= 0 ? reader.u32Array(hashes.ptr, hashes.count) : [];
  const ptrs = textures.ptr >= 0 ? reader.ptrArray(textures.ptr, textures.count) : [];
  return ptrs.map((p, i) => (p >= 0 ? { ...readTexture(reader, p), hash: hashValues[i] } : null)).filter(Boolean);
}

// TextureBase (0x50) + Texture fields (to 0x90):
//   0x28 name ptr   0x40 usage data
//   0x50 u16 width  0x52 u16 height  0x54 u16 depth  0x56 u16 stride
//   0x58 u32 format 0x5D u8 levels   0x70 data ptr (graphics segment)
export function readTexture(reader, off) {
  const name = reader.string(reader.ptrAt(off + 0x28));
  const width = reader.u16(off + 0x50);
  const height = reader.u16(off + 0x52);
  const depth = reader.u16(off + 0x54);
  const stride = reader.u16(off + 0x56);
  const format = reader.u32(off + 0x58);
  const levels = reader.u8(off + 0x5d);
  const dataOffset = reader.ptrAt(off + 0x70);
  const usage = reader.u32(off + 0x40) & 0x1f;
  return {
    name,
    width,
    height,
    depth,
    stride,
    format,
    formatName: formatName(format),
    levels,
    usage,
    supported: isSupportedFormat(format) && dataOffset >= 0 && width > 0 && height > 0,
    // Lazily decoded RGBA8 pixels of mip 0.
    decode() {
      if (!isSupportedFormat(format)) throw new ResourceError(`Texture format ${formatName(format)} is not supported.`);
      if (dataOffset < 0) throw new ResourceError('Texture has no pixel data.');
      const need = level0Size(format, width, height);
      const avail = reader.data.length - dataOffset;
      const bytes = reader.data.subarray(dataOffset, dataOffset + Math.min(avail, Math.max(need, stride * height)));
      return decodeToRGBA(format, width, height, bytes, stride);
    },
  };
}

// Loads a .ytd file (Uint8Array) and returns its textures.
export async function loadYtd(bytes) {
  const res = await openResource(bytes);
  if (res.version === YTD_VERSION_GEN9) {
    throw new ResourceError('This .ytd is in the GTA V Enhanced (gen9) format, which FiveM does not use. Not supported.');
  }
  const textures = readTextureDictionary(res.reader, 0);
  return { version: res.version, textures };
}
