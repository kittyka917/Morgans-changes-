import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classify, buildCatalog, textureLabel } from '../src/naming.js';

test('classifies component, prop and unknown files', () => {
  const d = classify('stream/mp_m_freemode_01_mybrand^jbib_012_u.ydd');
  assert.deepEqual([d.kind, d.collection, d.slot, d.index, d.variant], ['drawable', 'mp_m_freemode_01_mybrand', 'jbib', 12, 'u']);
  const t = classify('stream/mp_m_freemode_01_mybrand^JBIB_DIFF_012_B_WHI.ytd');
  assert.deepEqual([t.kind, t.slot, t.index, t.letter, t.race], ['texture', 'jbib', 12, 'b', 'whi']);
  assert.equal(textureLabel(t), 'B · white');
  const p = classify('props/mp_f_freemode_01_p_mine^p_head_003.ydd');
  assert.deepEqual([p.slot, p.isProp, p.index], ['p_head', true, 3]);
  const pt = classify('props/mp_f_freemode_01_p_mine^p_head_diff_003_c.ytd');
  assert.deepEqual([pt.slot, pt.index, pt.letter], ['p_head', 3, 'c']);
  assert.equal(classify('stream/some_random_prop.ydd').slot, null);
  assert.equal(classify('fxmanifest.lua'), null);
  assert.equal(classify('a\\b\\uppr_001_r.ydd').folder, 'a/b');
});

test('pairs drawables with their texture variants per collection', () => {
  const files = [
    'mp_m_a^jbib_000_u.ydd', 'mp_m_a^jbib_diff_000_b_uni.ytd', 'mp_m_a^jbib_diff_000_a_uni.ytd',
    'mp_m_b^jbib_000_u.ydd', 'mp_m_b^jbib_diff_000_a_uni.ytd',
    'mp_m_a^lowr_002_r.ydd', 'mp_m_a^lowr_diff_002_a_whi.ytd',
    'mp_m_a^stray_diff.ytd',
  ].map((path) => ({ path }));
  const { collections, looseTextures } = buildCatalog(files);
  assert.deepEqual(collections.map((c) => c.name), ['mp_m_a', 'mp_m_b']);
  const a = collections[0];
  assert.deepEqual(a.slots.map((s) => s.key), ['lowr', 'jbib']); // ordered by component id (4, 11)
  const top = a.slots[1].items[0];
  assert.deepEqual(top.textures.map((t) => t.info.letter), ['a', 'b']);
  assert.equal(collections[1].slots[0].items[0].textures.length, 1); // no cross-collection pairing
  assert.deepEqual(looseTextures.map((t) => t.path), ['mp_m_a^stray_diff.ytd']);
});
