// Small synthetic .ytd / .ydd files built with src/rscwrite.js.
//
// No real GTA assets ship with this repo, so these fixtures exercise the full
// pipeline (RSC7 header, deflate, page flags, pointer resolution, struct reads)
// with known contents. The writer shares the struct offsets the parser uses, so
// these tests can't catch a wrong offset; only a real game file can.

import { writeYtd, writeYdd } from '../src/rscwrite.js';

const DXT1_RED = [0x00, 0xf8, 0x00, 0xf8, 0, 0, 0, 0]; // c0 = c1 = 0xF800, all index 0
const DXT1_BLUE = [0x1f, 0x00, 0x1f, 0x00, 0, 0, 0, 0];

// 8x8 DXT1 (left column of blocks red, right blue) + 2x2 A8R8G8B8.
export function buildYtd() {
  const dxt = new Uint8Array([...DXT1_RED, ...DXT1_BLUE, ...DXT1_RED, ...DXT1_BLUE]);
  const argb = new Uint8Array([0, 0, 255, 255, 0, 255, 0, 255, 255, 0, 0, 255, 255, 255, 255, 128]); // B G R A
  return writeYtd([
    { name: 'jbib_diff_000_a_uni', width: 8, height: 8, format: 0x31545844, stride: 16, pixels: dxt, hash: 111 },
    { name: 'tiny_argb', width: 2, height: 2, format: 21, stride: 8, pixels: argb, hash: 222 },
  ]);
}

export const QUAD = {
  positions: [-0.5, 0, 0, 0.5, 0, 0, 0.5, 0, 1, -0.5, 0, 1],
  normals: [0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0],
  uvs: [0, 1, 1, 1, 1, 0, 0, 0],
  indices: [0, 1, 2, 0, 2, 3],
};

export function buildYdd({ layout = 'gtav1', name = 'jbib_000_u' } = {}) {
  return writeYdd({ name, hash: 0x1234abcd, diffuseName: 'jbib_diff_000_a_uni', geometries: [QUAD], layout });
}
