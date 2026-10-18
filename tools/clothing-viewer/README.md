# Seamline — clothing viewer for FiveM

An OpenIV-style viewer for GTA V clothing files: open a resource's `stream`
folder, browse every drawable by component, and look at each one in 3D with
its texture variants. Everything runs in the browser and reads your files
locally. Nothing is uploaded.

## Use it

1. Open **`dist/seamline.html`** in Chrome, Edge or Firefox. Double-clicking the
   file works. It needs an internet connection to load three.js and fonts.
2. Click **Open stream folder** and pick the clothing resource's `stream`
   folder (or the folder above it). You can also drag the folder onto the page.

| Key | Action |
|---|---|
| ↑ / ↓ (or j / k) | Previous / next model |
| ← / → (or h / l) | Previous / next texture variant |
| / | Jump to the filter box |
| Drag / right-drag / scroll | Orbit / pan / zoom |

The toolbar switches LOD (high → very low), wireframe, alpha cut-out, the
cutting-mat grid (10 cm squares) and turntable spin. The yellow tape shows the
model's width, depth and height in centimetres.

**Export:** the model as `.glb` (with the current texture embedded), the
texture as `.png`, or a screenshot of the viewport.

## What it reads

| | Supported |
|---|---|
| Files | Loose `.ydd` (drawable dictionaries) and `.ytd` (texture dictionaries), legacy / FiveM format |
| Texture formats | DXT1, DXT3, DXT5, BC4 (ATI1), BC5 (ATI2), BC7, A8R8G8B8, X8R8G8B8, A8B8G8R8, A1R5G5B5, A8, L8 |
| Vertex data | Any layout described by the file's vertex declaration (float, half and packed formats) |

Models and textures are paired by file name, following the game's convention:

```
[collection^]jbib_000_u.ydd            ← drawable (component 11, number 000)
[collection^]jbib_diff_000_a_uni.ytd   ← texture variant "a"
[collection^]jbib_diff_000_b_uni.ytd   ← texture variant "b"
[collection^]p_head_000.ydd            ← prop
[collection^]p_head_diff_000_a.ytd
```

Files that don't follow the pattern still show up: under *Other models*, or
under *Loose textures*, where they open as a flat image. Any loaded texture can
be tried on any model from the inspector.

**Not supported:**

- **`.rpf` archives.** They're encrypted with keys taken from the game
  executable. Extract the files first (OpenIV or CodeWalker), then open the folder.
- **FiveM escrow-encrypted assets.** These can't be read outside the server.
- **GTA V Enhanced (gen9) resources.** FiveM doesn't use them. The viewer says
  so instead of failing silently.
- **Skinning.** Ped clothing is shown in its bind pose, without a ped body under it.

A file that can't be read is listed in the inspector with the reason, and the
rest of the folder keeps working.

## How it works

| File | Role |
|---|---|
| `src/rsc.js` | RSC7 container: header, raw-deflate decompression, page sizes, pointer resolution |
| `src/ytd.js` | Texture dictionaries |
| `src/ydd.js` | Drawable dictionaries → meshes (LODs, geometries, vertex declarations, shaders) |
| `src/bcn.js` | Texture decoding (BC1–BC5, BC7 and uncompressed formats) |
| `src/naming.js` | Groups files into collections, component slots and texture variants |
| `src/main.js`, `src/app.html` | The viewer UI (three.js) |
| `src/demo.js`, `src/rscwrite.js` | Builds the demo outfit as real `.ydd`/`.ytd` bytes |

The structure offsets follow [CodeWalker](https://github.com/dexyfex/CodeWalker)'s
resource classes (legacy, non-gen9 paths). The block decoders are a port of
[bcdec](https://github.com/iOrange/bcdec) (MIT / Unlicense).

## Develop

```bash
npm install
npm test        # decoder + parser + naming tests
npm run build   # writes dist/seamline.html
```

The tests check:

- **Texture decoders:** compared byte-for-byte with bcdec's C output on 20,000
  random blocks per format (`test/bcdec-reference.md`).
- **Page-size decoding:** checked against the examples in CodeWalker's source.
- **Parsers:** run end to end on `.ydd`/`.ytd` files built by `src/rscwrite.js`.
  That writer uses the same struct offsets as the parser, so these tests can't
  catch a wrong offset. Only a real game file can.
