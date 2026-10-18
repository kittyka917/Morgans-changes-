// Drawable dictionaries (.ydd) -> plain mesh data.
// Struct offsets follow CodeWalker's legacy (non-gen9) DrawableDictionary, DrawableBase,
// Drawable, ShaderGroup, ShaderFX, ShaderParametersBlock, DrawableModel,
// DrawableGeometry, VertexBuffer, VertexDeclaration and IndexBuffer.

import { openResource, ResourceError, joaat } from './rsc.js';
import { readTextureDictionary } from './ytd.js';

export const YDD_VERSION = 165;
const YDD_VERSION_GEN9 = 159;

const DIFFUSE_SAMPLER = joaat('diffusesampler');

// VertexSemantics bit indices.
const SEM_POSITION = 0, SEM_NORMAL = 3, SEM_COLOUR0 = 4, SEM_TEXCOORD0 = 6;

// VertexComponentType -> size in bytes.
const COMPONENT_SIZE = [0, 4, 4, 8, 0, 8, 12, 16, 4, 4, 4, 0, 0, 0, 0, 0];

const LOD_NAMES = ['high', 'med', 'low', 'vlow'];

function halfToFloat(h) {
  const s = h & 0x8000 ? -1 : 1;
  const e = (h >> 10) & 0x1f;
  const f = h & 0x3ff;
  if (e === 0) return s * Math.pow(2, -14) * (f / 1024);
  if (e === 31) return f ? NaN : s * Infinity;
  return s * Math.pow(2, e - 15) * (1 + f / 1024);
}

// Reads one vertex component as an array of numbers.
function readComponent(reader, off, type) {
  switch (type) {
    case 1: return [halfToFloat(reader.u16(off)), halfToFloat(reader.u16(off + 2))]; // Half2
    case 2: return [reader.f32(off)]; // Float
    case 3: return [0, 2, 4, 6].map((o) => halfToFloat(reader.u16(off + o))); // Half4
    case 5: return [reader.f32(off), reader.f32(off + 4)]; // Float2
    case 6: return [reader.f32(off), reader.f32(off + 4), reader.f32(off + 8)]; // Float3
    case 7: return [reader.f32(off), reader.f32(off + 4), reader.f32(off + 8), reader.f32(off + 12)]; // Float4
    case 8: // UByte4
    case 9: // Colour (unorm bytes)
      return [reader.u8(off), reader.u8(off + 1), reader.u8(off + 2), reader.u8(off + 3)];
    case 10: // RGBA8SNorm
      return [0, 1, 2, 3].map((o) => {
        const b = reader.u8(off + o);
        return Math.max(-1, (b > 127 ? b - 256 : b) / 127);
      });
    default:
      return null;
  }
}

// VertexDeclaration (16 bytes): u32 flags, u16 stride, u8 unk, u8 count, u64 types (4 bits per semantic).
function readVertexDeclaration(reader, off) {
  const flags = reader.u32(off);
  const stride = reader.u16(off + 4);
  const typesLo = reader.u32(off + 8);
  const typesHi = reader.u32(off + 12);
  const typeOf = (i) => (i < 8 ? (typesLo >>> (i * 4)) & 0xf : (typesHi >>> ((i - 8) * 4)) & 0xf);
  const components = {};
  let offset = 0;
  for (let i = 0; i < 16; i++) {
    if ((flags >>> i) & 1) {
      const type = typeOf(i);
      components[i] = { type, offset };
      offset += COMPONENT_SIZE[type];
    }
  }
  return { flags, stride, computedStride: offset, components };
}

// VertexBuffer (128 bytes): 0x08 u16 stride, 0x10 data ptr 1, 0x18 u32 count, 0x20 data ptr 2, 0x30 decl ptr.
function readVertexBuffer(reader, off) {
  const stride = reader.u16(off + 0x08);
  const data1 = reader.ptrAt(off + 0x10);
  const count = reader.u32(off + 0x18);
  const data2 = reader.ptrAt(off + 0x20);
  const declOff = reader.ptrAt(off + 0x30);
  if (declOff < 0) throw new ResourceError('Vertex buffer has no vertex declaration.');
  const decl = readVertexDeclaration(reader, declOff);
  const dataOff = data1 >= 0 ? data1 : data2;
  if (dataOff < 0) throw new ResourceError('Vertex buffer has no vertex data.');

  const pos = decl.components[SEM_POSITION];
  if (!pos) throw new ResourceError('Vertex declaration has no position.');
  const nrm = decl.components[SEM_NORMAL];
  const uv = decl.components[SEM_TEXCOORD0];
  const col = decl.components[SEM_COLOUR0];

  const positions = new Float32Array(count * 3);
  const normals = nrm ? new Float32Array(count * 3) : null;
  const uvs = uv ? new Float32Array(count * 2) : null;
  const colors = col && col.type === 9 ? new Float32Array(count * 4) : null;
  reader.check(dataOff, stride * count);
  for (let v = 0; v < count; v++) {
    const base = dataOff + v * stride;
    const p = readComponent(reader, base + pos.offset, pos.type);
    positions[v * 3] = p[0]; positions[v * 3 + 1] = p[1]; positions[v * 3 + 2] = p[2];
    if (normals) {
      const n = readComponent(reader, base + nrm.offset, nrm.type);
      if (n && n.length >= 3) {
        const scale = nrm.type === 9 ? 1 / 127.5 : 1; // unorm-packed normals
        const bias = nrm.type === 9 ? -1 : 0;
        normals[v * 3] = n[0] * scale + bias; normals[v * 3 + 1] = n[1] * scale + bias; normals[v * 3 + 2] = n[2] * scale + bias;
      }
    }
    if (uvs) {
      const t = readComponent(reader, base + uv.offset, uv.type);
      if (t) { uvs[v * 2] = t[0]; uvs[v * 2 + 1] = t[1]; }
    }
    if (colors) {
      const c = readComponent(reader, base + col.offset, col.type);
      colors[v * 4] = c[0] / 255; colors[v * 4 + 1] = c[1] / 255; colors[v * 4 + 2] = c[2] / 255; colors[v * 4 + 3] = c[3] / 255;
    }
  }
  return { count, stride, decl, positions, normals, uvs, colors };
}

// IndexBuffer (96 bytes): 0x08 u32 count, 0x10 indices ptr (u16 each).
function readIndexBuffer(reader, off) {
  const count = reader.u32(off + 0x08);
  const ptr = reader.ptrAt(off + 0x10);
  if (ptr < 0) throw new ResourceError('Index buffer has no data.');
  reader.check(ptr, count * 2);
  const indices = new Uint16Array(count);
  for (let i = 0; i < count; i++) indices[i] = reader.u16(ptr + i * 2);
  return indices;
}

// DrawableGeometry (0x98 bytes): 0x18 vertex buffer ptr, 0x38 index buffer ptr.
function readGeometry(reader, off) {
  const vbOff = reader.ptrAt(off + 0x18);
  const ibOff = reader.ptrAt(off + 0x38);
  if (vbOff < 0 || ibOff < 0) throw new ResourceError('Geometry is missing its vertex or index buffer.');
  const vb = readVertexBuffer(reader, vbOff);
  const indices = readIndexBuffer(reader, ibOff);
  for (let i = 0; i < indices.length; i++) {
    if (indices[i] >= vb.count) throw new ResourceError(`Index ${indices[i]} is past the end of the vertex buffer (${vb.count}).`);
  }
  return { ...vb, indices };
}

// DrawableModel (0x30 + arrays): 0x08 geometries ptr, 0x10 u16 count, 0x20 shader mapping ptr,
// 0x28 u32 skeleton binding (bone index in the top byte).
function readModel(reader, off) {
  const geomsPtr = reader.ptrAt(off + 0x08);
  const count = reader.u16(off + 0x10);
  const mapPtr = reader.ptrAt(off + 0x20);
  const binding = reader.u32(off + 0x28);
  const geomPtrs = geomsPtr >= 0 ? reader.ptrArray(geomsPtr, count) : [];
  const geometries = [];
  geomPtrs.forEach((p, i) => {
    if (p < 0) return;
    const shaderIndex = mapPtr >= 0 ? reader.u16(mapPtr + i * 2) : 0;
    geometries.push({ ...readGeometry(reader, p), shaderIndex });
  });
  return { boneIndex: (binding >>> 24) & 0xff, geometries };
}

// A LOD list pointer points at a list header { u64 ptr, u16 count, u16 capacity }.
function readModelList(reader, listOff) {
  if (listOff < 0) return null;
  const { ptr, count } = reader.listAt(listOff);
  if (ptr < 0 || count === 0) return null;
  return reader.ptrArray(ptr, count).filter((p) => p >= 0).map((p) => readModel(reader, p));
}

// ShaderFX (48 bytes): 0x00 params ptr, 0x08 u32 name hash, 0x10 u8 param count, 0x18 u32 file name hash.
// Parameters block: count x {u8 type, u8, u16, u32, u64 data ptr}, then embedded vector data
// (16 * type bytes for each type > 0), then count x u32 parameter name hashes.
function readShader(reader, off) {
  const paramsPtr = reader.ptrAt(off);
  const nameHash = reader.u32(off + 0x08);
  const count = reader.u8(off + 0x10);
  const fileHash = reader.u32(off + 0x18);
  const textures = [];
  if (paramsPtr >= 0 && count > 0) {
    let embedded = 0;
    const params = [];
    for (let i = 0; i < count; i++) {
      const p = paramsPtr + i * 16;
      const type = reader.u8(p);
      params.push({ type, dataPtr: reader.ptrAt(p + 8) });
      embedded += 16 * type;
    }
    const hashesOff = paramsPtr + count * 16 + embedded;
    params.forEach((param, i) => {
      if (param.type !== 0) return;
      const hash = reader.u32(hashesOff + i * 4);
      const name = param.dataPtr >= 0 ? reader.string(reader.ptrAt(param.dataPtr + 0x28)) : null;
      textures.push({ hash, name, isDiffuse: hash === DIFFUSE_SAMPLER });
    });
  }
  const diffuse = textures.find((t) => t.isDiffuse && t.name) || null;
  return { nameHash, fileHash, textures, diffuseName: diffuse ? diffuse.name : null };
}

// ShaderGroup (64 bytes): 0x08 embedded texture dictionary ptr, 0x10 shaders ptr, 0x18 u16 count.
function readShaderGroup(reader, off) {
  const texDictOff = reader.ptrAt(off + 0x08);
  const shadersPtr = reader.ptrAt(off + 0x10);
  const count = reader.u16(off + 0x18);
  const shaders = shadersPtr >= 0 ? reader.ptrArray(shadersPtr, count).map((p) => (p >= 0 ? readShader(reader, p) : null)) : [];
  const embeddedTextures = texDictOff >= 0 ? readTextureDictionary(reader, texDictOff) : [];
  return { shaders, embeddedTextures };
}

// Drawable (DrawableBase 168 bytes + name ptr at 0xA8):
//   0x10 shader group ptr  0x20 bounding centre / radius  0x30 bbox min  0x40 bbox max
//   0x50..0x68 model list ptrs (high, med, low, very low)
export function readDrawable(reader, off) {
  const sgOff = reader.ptrAt(off + 0x10);
  const bboxMin = [reader.f32(off + 0x30), reader.f32(off + 0x34), reader.f32(off + 0x38)];
  const bboxMax = [reader.f32(off + 0x40), reader.f32(off + 0x44), reader.f32(off + 0x48)];
  const lods = {};
  LOD_NAMES.forEach((name, i) => {
    const models = readModelList(reader, reader.ptrAt(off + 0x50 + i * 8));
    if (models) lods[name] = models;
  });
  let name = null;
  try { name = reader.string(reader.ptrAt(off + 0xa8)); } catch { /* name is optional */ }
  const shaderGroup = sgOff >= 0 ? readShaderGroup(reader, sgOff) : { shaders: [], embeddedTextures: [] };
  return { name, bboxMin, bboxMax, lods, ...shaderGroup };
}

// DrawableDictionary (64 bytes): 0x20 list64<u32> hashes, 0x30 list64<Drawable*> drawables.
export function readDrawableDictionary(reader, off) {
  const hashes = reader.listAt(off + 0x20);
  const drawables = reader.listAt(off + 0x30);
  const hashValues = hashes.ptr >= 0 ? reader.u32Array(hashes.ptr, hashes.count) : [];
  const ptrs = drawables.ptr >= 0 ? reader.ptrArray(drawables.ptr, drawables.count) : [];
  return ptrs.map((p, i) => (p >= 0 ? { hash: hashValues[i], ...readDrawable(reader, p) } : null)).filter(Boolean);
}

// Loads a .ydd file (Uint8Array) and returns its drawables.
export async function loadYdd(bytes) {
  const res = await openResource(bytes);
  if (res.version === YDD_VERSION_GEN9) {
    throw new ResourceError('This .ydd is in the GTA V Enhanced (gen9) format, which FiveM does not use. Not supported.');
  }
  const drawables = readDrawableDictionary(res.reader, 0);
  return { version: res.version, drawables };
}

// Summary counts for the info panel.
export function drawableStats(drawable, lod = 'high') {
  const models = drawable.lods[lod] || [];
  let vertices = 0, triangles = 0, geometries = 0;
  for (const m of models) {
    for (const g of m.geometries) {
      geometries++;
      vertices += g.count;
      triangles += Math.floor(g.indices.length / 3);
    }
  }
  return { models: models.length, geometries, vertices, triangles };
}
