# Regenerating the BCn reference hashes

`bcn.test.mjs` compares the JS decoders in `src/bcn.js` with
[bcdec.h](https://github.com/iOrange/bcdec) v0.985, the C library they were
ported from. Each format gets 20,000 seeded random blocks, which covers every
BC7 mode (including the invalid "mode 8" block). The expected values are
SHA-256 hashes of bcdec's output.

To regenerate them:

1. Download `bcdec.h` and compile a small harness that calls `bcdec_bc1` …
   `bcdec_bc7` on consecutive blocks from a file, writing a 4×4 block's pixels
   one after another with a pitch of `4 * pixelSize` (4 bytes for BC1/2/3/7,
   1 byte for BC4, 2 bytes for BC5).
2. For each format, write `randomInput(fmt)` from `bcn-vectors.mjs` to a file,
   run the harness on it, and take the SHA-256 of the output.
3. Paste the hashes into `EXPECTED` in `bcn.test.mjs`.
