# MORGIE'S neon sign — 3D model

A modern LED-neon sign: pink neon tubes tracing the outlines of "MORGIE'S",
a pale-pink neon sakura blossom, an 8 mm clear acrylic backing, four chrome
wall standoffs and a power cable. Built in Blender 5.0.

## Files

| File | Use it for |
|---|---|
| `morgies_neon_sign.blend` | Blender — the master file. Open this if you're converting for FiveM |
| `morgies_neon_sign.glb` | Anything that takes glTF: web viewers, three.js, Unity/Unreal importers, Sketchfab |
| `morgies_neon_sign.fbx` | Most 3D apps and game engines |
| `morgies_neon_sign.obj` + `.mtl` | Universal fallback |

## Specs

| | |
|---|---|
| Size | 102.0 × 27.6 cm sign face, 5.2 cm deep; the cable hangs ~40 cm below |
| Triangles | 11,820 — light enough for a game prop |
| Objects | 1 mesh, 5 materials: `neon_pink`, `neon_pale`, `acrylic`, `chrome`, `cable` |
| Units | metres, real-world scale |
| Orientation | upright, facing Blender's front view (−Y), text-up is +Z |
| Origin | back-centre of the sign — sits flush on a wall at the origin |

All of the above was checked by re-importing the FBX and OBJ into a fresh
Blender session and the GLB with trimesh.

## The glow

- **GLB** carries it fully: the neon materials use glTF's
  `KHR_materials_emissive_strength`, and the acrylic uses
  `KHR_materials_transmission` + IOR, so it renders as clear plastic in viewers
  that support them.
- **FBX / OBJ** can't express glow strength reliably. If the tubes import
  looking flat, set the `neon_pink` and `neon_pale` materials to emissive
  (strength ~2.5–3 in Blender/Cycles).
- In a real-time engine, the halo around the tubes comes from that engine's
  bloom, not from the model.

## Into FiveM

FiveM needs `.ydr` (model) + `.ytyp` (archetype). The usual route:

1. Open `morgies_neon_sign.blend` in Blender with the **Sollumz** add-on.
2. Convert the object to a Sollumz drawable; give the two neon materials an
   emissive shader (e.g. `emissive.sps`) and the acrylic a glass shader.
3. Export the `.ydr`, generate a `.ytyp`, and stream both in a resource.

This hasn't been tested in-game.

## Renders

`render_hero.png` and `render_front.png` — Cycles, 1920×1080. The brick wall,
camera and the halo light behind the panel exist only in the render scene;
none of it is in the model files.

## Rebuilding

The scripts are in `promo/neon/` and run on Blender's Python module
(`pip install bpy`, Blender 5.0):

```
python build_sign.py -- model/                                         # model + exports
python render_sign.py -- model/morgies_neon_sign.blend model/render_hero.png hero 1 96
```

`render_sign.py` args: blend, output png, view (`hero` / `front` / `low`), scale of 1920×1080, Cycles samples. The build also writes `stats.txt` (width, height, triangles).
