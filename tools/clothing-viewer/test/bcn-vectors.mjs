// Seeded random BCn blocks shared by bcn.test.mjs and the bcdec cross-check script.
import {
  decodeBC1Block, decodeBC2Block, decodeBC3Block, decodeBC4Block, decodeBC5Block, decodeBC7Block,
} from '../src/bcn.js';

export const BLOCKS = 20000;

export function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const FORMATS = {
  1: { blockBytes: 8, pixelSize: 4, decode: decodeBC1Block },
  2: { blockBytes: 16, pixelSize: 4, decode: decodeBC2Block },
  3: { blockBytes: 16, pixelSize: 4, decode: decodeBC3Block },
  4: { blockBytes: 8, pixelSize: 1, decode: decodeBC4Block },
  5: { blockBytes: 16, pixelSize: 2, decode: decodeBC5Block },
  7: { blockBytes: 16, pixelSize: 4, decode: decodeBC7Block },
};

export function randomInput(fmt) {
  const rand = mulberry32(1000 + Number(fmt));
  const input = new Uint8Array(BLOCKS * FORMATS[fmt].blockBytes);
  for (let i = 0; i < input.length; i++) input[i] = Math.floor(rand() * 256);
  return input;
}

export function decodeAll(fmt, input) {
  const { blockBytes, pixelSize, decode } = FORMATS[fmt];
  const out = new Uint8Array(BLOCKS * 16 * pixelSize);
  for (let b = 0; b < BLOCKS; b++) decode(input, b * blockBytes, out, b * 16 * pixelSize, 4 * pixelSize);
  return out;
}
