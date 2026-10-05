"""Render the sign on a dark brick wall. Stage objects are added here only — the exported files never contain them."""
import bpy, sys, math, os
from mathutils import Vector
args = sys.argv[sys.argv.index('--')+1:]
BLEND, OUTPNG, VIEW, RES, SAMPLES = args[0], args[1], args[2], float(args[3]), int(args[4])
PASSES = len(args) > 5 and args[5] == 'passes'   # loop mode: one EXR, one light group per letter
bpy.ops.wm.open_mainfile(filepath=BLEND)
scene = bpy.context.scene
STAGE = bpy.data.collections.get('STAGE') or bpy.data.collections.new('STAGE')
if STAGE.name not in scene.collection.children: scene.collection.children.link(STAGE)

# wall: dark painted brick, so the neon has something to light
bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0), rotation=(math.radians(90), 0, 0)); wall = bpy.context.active_object
for c in wall.users_collection: c.objects.unlink(wall)
STAGE.objects.link(wall)
m = bpy.data.materials.new('brick'); m.use_nodes = True; nt = m.node_tree
bsdf = nt.nodes['Principled BSDF']; bsdf.inputs['Roughness'].default_value = 0.85
bt = nt.nodes.new('ShaderNodeTexBrick')
bt.inputs['Color1'].default_value = (0.075, 0.060, 0.066, 1)
bt.inputs['Color2'].default_value = (0.050, 0.042, 0.047, 1)
bt.inputs['Mortar'].default_value = (0.012, 0.011, 0.012, 1)
bt.inputs['Scale'].default_value = 9.0; bt.inputs['Mortar Size'].default_value = 0.012
tc = nt.nodes.new('ShaderNodeTexCoord')
nt.links.new(tc.outputs['Object'], bt.inputs['Vector'])
nt.links.new(bt.outputs['Color'], bsdf.inputs['Base Color'])
bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.35
nt.links.new(bt.outputs['Fac'], bump.inputs['Height']); nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
wall.data.materials.append(m)

# glow on the wall: a soft pink area light just in front of the sign, aimed at the
# wall. Stage only — stands in for the halo real neon throws on a wall.
ld = bpy.data.lights.new('wallglow', 'AREA'); ld.shape = 'RECTANGLE'
ld.size = 0.95; ld.size_y = 0.22; ld.energy = 1.6; ld.color = (1.0, 0.22, 0.60)
lo = bpy.data.objects.new('wallglow', ld); STAGE.objects.link(lo)
lo.location = (0.0, -0.011, 0.0);   # in the gap between wall and acrylic: a halo, not a floodlight
lo.rotation_euler = (math.radians(90), 0, 0)    # area lights emit along local -Z; +90 about X turns that to +Y, onto the wall

# camera
cam_d = bpy.data.cameras.new('cam'); cam_d.lens = 45
cam = bpy.data.objects.new('cam', cam_d); STAGE.objects.link(cam); scene.camera = cam
target = Vector((0.04, -0.03, -0.04))     # sign is upright, facing -Y; back on the y=0 wall
cam.location = {'hero':  Vector((0.50, -1.22, -0.12)),
                'front': Vector((0.04, -1.38, -0.04)),
                'low':   Vector((-0.55, -1.10, -0.42))}[VIEW]
d = target - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

# world: near-black with a whisper of fill so the unlit parts read
w = bpy.data.worlds.new('w'); scene.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.008, 0.006, 0.010, 1)
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0

# Cycles, CPU
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.render.resolution_x = int(1920*RES); scene.render.resolution_y = int(1080*RES)
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'AgX'
try: scene.view_settings.look = 'AgX - Punchy'
except Exception: pass
scene.render.film_transparent = False

# compositor bloom (Blender 5 keeps the compositor in a node group)
try:
    ng = bpy.data.node_groups.new('comp', 'CompositorNodeTree')
    scene.compositing_node_group = ng
    rl = ng.nodes.new('CompositorNodeRLayers')
    gl = ng.nodes.new('CompositorNodeGlare')
    outn = ng.nodes.new('NodeGroupOutput')
    ng.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    for k, v in (('Type','Bloom'),('Quality','High'),('Threshold',0.9),('Size',0.6),('Strength',0.55)):
        if k in gl.inputs:
            try: gl.inputs[k].default_value = v
            except Exception: pass
    ng.links.new(rl.outputs['Image'], gl.inputs['Image'])
    ng.links.new(gl.outputs['Image'], outn.inputs[0])
    print("compositor: bloom on")
except Exception as e:
    print("compositor skipped:", e)

if PASSES:
    # Light is additive, so a render split into light groups can be re-lit per frame
    # afterwards: frame = sum(weight_i(t) * group_i). loop.py does that. Each letter's
    # tubes, the blossom, the halo light and the world get their own group.
    sign = next(o for o in scene.objects if o.type == 'MESH' and o.name.startswith('morgies_neon_sign'))
    bpy.ops.object.select_all(action='DESELECT'); sign.select_set(True); bpy.context.view_layer.objects.active = sign
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='MATERIAL'); bpy.ops.object.mode_set(mode='OBJECT')
    parts = {o.active_material.name: o for o in bpy.context.selected_objects}
    pink = parts['neon_pink']
    bpy.ops.object.select_all(action='DESELECT'); pink.select_set(True); bpy.context.view_layer.objects.active = pink
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='LOOSE'); bpy.ops.object.mode_set(mode='OBJECT')
    contours = []
    for o in bpy.context.selected_objects:
        xs = [(o.matrix_world @ v.co).x for v in o.data.vertices]
        contours.append([min(xs), max(xs), [o]])
    contours.sort(key=lambda c: c[0])
    letters = []                                  # contours overlapping in x belong to one glyph (O, R ...)
    for c in contours:
        if letters and c[0] < letters[-1][1] - 0.002:
            letters[-1][1] = max(letters[-1][1], c[1]); letters[-1][2] += c[2]
        else: letters.append(c)
    vl = bpy.context.view_layer
    names = ['L%d' % i for i in range(len(letters))] + ['blossom', 'halo', 'amb']
    for n in names: vl.lightgroups.add(name=n)
    for i, (x0, x1, objs) in enumerate(letters):
        for o in objs: o.lightgroup = 'L%d' % i
        print('LETTER', i, round(x0, 4), round(x1, 4), len(objs))
    parts['neon_pale'].lightgroup = 'blossom'
    lo.lightgroup = 'halo'
    w.lightgroup = 'amb'
    vl.cycles.denoising_store_passes = True       # albedo + normal, to guide per-group denoising
    scene.cycles.use_denoising = False
    scene.compositing_node_group = None
    scene.render.image_settings.media_type = 'MULTI_LAYER_IMAGE'
    scene.render.image_settings.file_format = 'OPEN_EXR_MULTILAYER'
    scene.render.image_settings.color_depth = '32'
    scene.render.image_settings.exr_codec = 'ZIP'
    scene.render.filepath = OUTPNG
else:
    scene.render.filepath = OUTPNG
    scene.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)
print("RENDERED", OUTPNG)
