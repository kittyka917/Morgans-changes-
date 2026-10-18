// Checks the JS block decoders against bcdec.h (the C library they were ported from).
// Inputs are seeded random blocks; expected values are SHA-256 hashes of bcdec's
// output for the same inputs. To regenerate them, see test/bcdec-reference.md.
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FORMATS, randomInput, decodeAll } from './bcn-vectors.mjs';

// sha256 of bcdec v0.985 output for randomInput(fmt), one 4x4 block after another.
const EXPECTED = {
  1: '3ead672ac84633919e1858668ce969318e3699ebf2a5bef00154153e833d6278',
  2: '34552806912163829ed2e250e9c6e1274d9614c271ce7f95699ffb046dcd73bb',
  3: '6e1c93b4c4a73c8b2ed4fb9fe67e452431122efc96409448a85c53b27a893993',
  4: '291317089df36a12fbc485805243b3c2e744e68dc8fb512bd64088377ceaf5eb',
  5: '3811b8be289603debcb4616e228a71866e401f20a9d9e021347c0a2af8d4dae8',
  7: '7baaac8a55a64c8bab41f48eba4e6601d92c3be017a9464fef69bd20d4545e44',
};

for (const fmt of Object.keys(FORMATS)) {
  test(`BC${fmt} matches bcdec`, () => {
    const out = decodeAll(fmt, randomInput(fmt));
    assert.equal(createHash('sha256').update(out).digest('hex'), EXPECTED[fmt]);
  });
}
