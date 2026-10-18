import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadYtd } from '../src/ytd.js';
import { loadYdd, drawableStats } from '../src/ydd.js';
import { openResource, sizeFromFlags, ResourceError } from '../src/rsc.js';
import { buildYtd, buildYdd } from './fixtures.mjs';

test('page flag sizes match CodeWalker examples', () => {
  // Examples listed in CodeWalker's GetSizeFromFlags comments.
  const enc = (ss, f) => (ss | f) >>> 0;
  assert.equal(sizeFromFlags(enc(0, 1 << 17)), 8192); // ss:0 s4:1 (ytd)
  assert.equal(sizeFromFlags(enc(0, 1 << 11)), 16384); // ss:0 s5:1
  assert.equal(sizeFromFlags(enc(1, 1 << 4)), 262144); // ss:1 s8:1 (yft)
  assert.equal(sizeFromFlags(enc(1, 9 << 7)), 589824); // ss:1 s6:9 (ytd)
  assert.equal(sizeFromFlags(enc(4, (15 << 17) | (2 << 5))), 4063232); // ss:4 s4:15 s7:2 (ytd)
});

test('ytd: textures, names and pixels', async () => {
  const { version, textures } = await loadYtd(await buildYtd());
  assert.equal(version, 13);
  assert.equal(textures.length, 2);
  const [dxt, argb] = textures;
  assert.equal(dxt.name, 'jbib_diff_000_a_uni');
  assert.equal(dxt.formatName, 'DXT1');
  assert.deepEqual([dxt.width, dxt.height, dxt.hash], [8, 8, 111]);
  const px = dxt.decode();
  assert.deepEqual([...px.subarray(0, 4)], [255, 0, 0, 255]); // top-left: red block
  assert.deepEqual([...px.subarray(4 * 4, 4 * 4 + 4)], [0, 0, 255, 255]); // x=4: blue block
  assert.deepEqual([...px.subarray((7 * 8 + 7) * 4, (7 * 8 + 7) * 4 + 4)], [0, 0, 255, 255]);
  assert.equal(argb.formatName, 'A8R8G8B8');
  assert.deepEqual([...argb.decode()], [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 128]);
});

for (const layout of ['gtav1', 'packed']) {
  test(`ydd (${layout} vertex layout): mesh, shader and diffuse name`, async () => {
    const { version, drawables } = await loadYdd(await buildYdd({ layout }));
    assert.equal(version, 165);
    assert.equal(drawables.length, 1);
    const d = drawables[0];
    assert.equal(d.name, 'jbib_000_u');
    assert.equal(d.hash, 0x1234abcd);
    assert.deepEqual(d.bboxMax, [0.5, 0, 1]);
    assert.deepEqual(drawableStats(d), { models: 1, geometries: 1, vertices: 4, triangles: 2 });
    const g = d.lods.high[0].geometries[0];
    assert.deepEqual([...g.positions], [-0.5, 0, 0, 0.5, 0, 0, 0.5, 0, 1, -0.5, 0, 1]);
    assert.deepEqual([...g.indices], [0, 1, 2, 0, 2, 3]);
    assert.deepEqual([...g.uvs], [0, 1, 1, 1, 1, 0, 0, 0]);
    assert.deepEqual([...g.normals.subarray(0, 3)].map((n) => Math.round(n * 1000) / 1000), [0, -1, 0]);
    assert.equal(d.shaders.length, 1);
    assert.equal(d.shaders[0].diffuseName, 'jbib_diff_000_a_uni');
    assert.equal(g.shaderIndex, 0);
  });
}

test('rejects non-resources and gen9 files with a clear message', async () => {
  await assert.rejects(openResource(new TextEncoder().encode('hello world, not a resource')), ResourceError);
  const gen9 = new Uint8Array(32);
  gen9.set([0x52, 0x53, 0x43, 0x38]);
  await assert.rejects(openResource(gen9), /Enhanced \(gen9\)/);
  const ytd = await buildYtd();
  new DataView(ytd.buffer).setUint32(4, 5, true);
  await assert.rejects(loadYtd(ytd), /gen9/);
});

test('corrupt pointer raises ResourceError instead of reading garbage', async () => {
  const { openResource: open } = await import('../src/rsc.js');
  const res = await open(await buildYdd());
  // Point the drawable list at an address past the end of the system segment.
  res.reader.dv.setUint32(0x30, 0x5fffff00, true);
  const { readDrawableDictionary } = await import('../src/ydd.js');
  assert.throws(() => readDrawableDictionary(res.reader, 0), ResourceError);
});
