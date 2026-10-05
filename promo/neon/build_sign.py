"""
MORGIE'S neon sign — built in Blender (bpy), real-world scale in metres.

Parts (all in the "SIGN" collection, which is what gets exported):
  tubes_text    pink LED-neon tubes tracing the letter outlines
  tube_blossom  pale-pink neon sakura blossom
  backing       8 mm clear acrylic, rounded rectangle
  standoffs     4 chrome wall standoffs
  cable         black power lead
The render scene (wall, camera) lives in a separate collection and is never exported.
"""
import bpy, math, os, sys, bmesh
from mathutils import Vector

OUT = sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else '/tmp/neon'
os.makedirs(OUT, exist_ok=True)
TEXT = "MORGIE’S"
PINK = (1.0, 0.07, 0.42)        # tube light — deep enough to survive AgX roll-off
PALE = (1.0, 0.72, 0.86)        # blossom light
FONT = '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'; scene.unit_settings.scale_length = 1.0

def collection(name):
    c = bpy.data.collections.new(name); scene.collection.children.link(c); return c
SIGN = collection('SIGN'); STAGE = collection('STAGE')
def link(obj, col):
    for c in obj.users_collection: c.objects.unlink(obj)
    col.objects.link(obj)

# ---------- materials ----------
def mat_neon(name, rgb, strength):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*[0.85 + 0.15*c for c in rgb], 1)   # milky silicone when unlit
    b.inputs['Roughness'].default_value = 0.35
    b.inputs['Emission Color'].default_value = (*rgb, 1)
    b.inputs['Emission Strength'].default_value = strength
    return m
def mat_acrylic():
    m = bpy.data.materials.new('acrylic'); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.95, 0.97, 1.0, 1)
    b.inputs['Roughness'].default_value = 0.04
    b.inputs['IOR'].default_value = 1.49
    b.inputs['Transmission Weight'].default_value = 1.0
    return m
def mat_metal(name, rgb, rough):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Metallic'].default_value = 1.0; b.inputs['Roughness'].default_value = rough
    return m
def mat_plain(name, rgb, rough):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = rough
    return m
M_NEON  = mat_neon('neon_pink',  PINK, 2.8)     # brighter than this and AgX bleaches the pink to white
M_BLOOM = mat_neon('neon_pale',  PALE, 2.6)
M_ACR   = mat_acrylic()
M_CHR   = mat_metal('chrome', (0.9, 0.9, 0.92), 0.12)
M_CAB   = mat_plain('cable', (0.02, 0.02, 0.02), 0.5)

# ---------- neon text: tubes along the glyph outlines ----------
font = bpy.data.fonts.load(FONT)
tc = bpy.data.curves.new('txt', 'FONT'); tc.body = TEXT; tc.font = font
tc.size = 0.20; tc.align_x = 'CENTER'; tc.align_y = 'CENTER'; tc.space_character = 1.06
tobj = bpy.data.objects.new('txt', tc); SIGN.objects.link(tobj)
bpy.context.view_layer.objects.active = tobj; tobj.select_set(True)
bpy.ops.object.convert(target='CURVE')            # font -> bezier outlines, one spline per contour
tubes = bpy.context.view_layer.objects.active; tubes.name = 'tubes_text'
cu = tubes.data
cu.dimensions = '3D'; cu.fill_mode = 'FULL'
cu.bevel_mode = 'ROUND'; cu.bevel_depth = 0.0055     # 11 mm tube
cu.bevel_resolution = 2; cu.resolution_u = 5
tubes.data.materials.clear(); tubes.data.materials.append(M_NEON)
tubes.location.z = 0.020                              # tubes sit 20 mm proud of the acrylic

# text extents, for laying out everything else
bpy.context.view_layer.update()
xs = [ (tubes.matrix_world @ Vector(c)).x for c in tubes.bound_box ]
ys = [ (tubes.matrix_world @ Vector(c)).y for c in tubes.bound_box ]
tx0, tx1, ty0, ty1 = min(xs), max(xs), min(ys), max(ys)

# ---------- sakura blossom tube ----------
def blossom_points(cx, cy, R, n=220):
    pts = []
    for i in range(n):
        th = i/n*2*math.pi
        lobe = abs(math.cos(2.5*th))**0.55                   # five petals
        tipd = (th*5/(2*math.pi)) % 1.0                       # 0 at petal tip
        tipd = min(tipd, 1-tipd)
        notch = 0.20*math.exp(-(tipd**2)/0.0025)              # the sakura notch at each tip
        r = R*(0.42 + 0.58*lobe - notch*lobe)
        a = th + math.pi/2
        pts.append((cx + r*math.cos(a), cy + r*math.sin(a), 0.0))
    return pts
bc = bpy.data.curves.new('blossom', 'CURVE'); bc.dimensions = '3D'
bc.fill_mode = 'FULL'; bc.bevel_mode='ROUND'; bc.bevel_depth = 0.0045; bc.bevel_resolution = 2
BR = 0.075
bcx, bcy = tx1 + 0.10, ty1 - 0.02
for spline_pts in (blossom_points(bcx, bcy, BR),):
    sp = bc.splines.new('POLY'); sp.points.add(len(spline_pts)-1)
    for p, (x, y, z) in zip(sp.points, spline_pts): p.co = (x, y, z, 1)
    sp.use_cyclic_u = True
# centre: a small ring of stamens
sp = bc.splines.new('POLY'); ring = [(bcx + 0.014*math.cos(a), bcy + 0.014*math.sin(a), 0) for a in [i/24*2*math.pi for i in range(24)]]
sp.points.add(len(ring)-1)
for p, (x, y, z) in zip(sp.points, ring): p.co = (x, y, z, 1)
sp.use_cyclic_u = True
bobj = bpy.data.objects.new('tube_blossom', bc); SIGN.objects.link(bobj)
bc.materials.append(M_BLOOM); bobj.location.z = 0.020

# ---------- acrylic backing: rounded rectangle, 8 mm ----------
pad = 0.055
bx0, bx1 = tx0 - pad, bcx + BR + pad*0.8
by0, by1 = ty0 - pad, max(ty1, bcy + BR) + pad
W_, H_ = bx1 - bx0, by1 - by0
bpy.ops.mesh.primitive_plane_add(size=1); back = bpy.context.active_object; back.name = 'backing'
back.scale = (W_, H_, 1); back.location = ((bx0+bx1)/2, (by0+by1)/2, 0)
bpy.ops.object.transform_apply(scale=True)
bev = back.modifiers.new('round', 'BEVEL'); bev.affect = 'VERTICES'; bev.width = 0.035; bev.segments = 8
sol = back.modifiers.new('thick', 'SOLIDIFY'); sol.thickness = 0.008; sol.offset = 0
bpy.ops.object.modifier_apply(modifier='round'); bpy.ops.object.modifier_apply(modifier='thick')
back.data.materials.append(M_ACR); link(back, SIGN)

# ---------- standoffs ----------
for i,(sx,sy) in enumerate([(bx0+0.03,by0+0.03),(bx1-0.03,by0+0.03),(bx0+0.03,by1-0.03),(bx1-0.03,by1-0.03)]):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.0065, depth=0.030, location=(sx, sy, -0.011))
    s = bpy.context.active_object; s.name = f'standoff_{i}'; s.data.materials.append(M_CHR); link(s, SIGN)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.0085, depth=0.004, location=(sx, sy, 0.006))
    c = bpy.context.active_object; c.name = f'standoff_cap_{i}'; c.data.materials.append(M_CHR); link(c, SIGN)

# ---------- power cable ----------
cc = bpy.data.curves.new('cable', 'CURVE'); cc.dimensions='3D'; cc.bevel_depth = 0.0028; cc.bevel_resolution = 2
sp = cc.splines.new('BEZIER'); sp.bezier_points.add(2)
pts = [((bx0+bx1)/2 + 0.12, by0 + 0.01, -0.006), ((bx0+bx1)/2 + 0.14, by0 - 0.12, -0.010), ((bx0+bx1)/2 + 0.08, by0 - 0.40, -0.012)]
for bp,(x,y,z) in zip(sp.bezier_points, pts):
    bp.co = (x,y,z); bp.handle_left_type = bp.handle_right_type = 'AUTO'
cobj = bpy.data.objects.new('cable', cc); SIGN.objects.link(cobj); cc.materials.append(M_CAB)

# ---------- curves -> meshes, so every exporter sees real geometry ----------
for o in [tubes, bobj, cobj]:
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target='MESH')

# ---------- origin at the sign's back-centre, so it mounts flush to a wall ----------
cx, cy = (bx0+bx1)/2, (by0+by1)/2
for o in SIGN.objects:
    o.location.x -= cx; o.location.y -= cy; o.location.z += 0.026
bpy.context.view_layer.update()

# ---------- stand it up ----------
# Built in the X-Y plane for convenience, which in Blender (Z-up) is the FLOOR.
# Rotate +90 deg about X: the face now points -Y (Blender's front view), text-up
# is +Z, and the back sits on the y=0 plane, flush against a wall.
from mathutils import Matrix
R = Matrix.Rotation(math.radians(90), 4, 'X')
for o in SIGN.objects:
    o.matrix_world = R @ o.matrix_world
bpy.context.view_layer.update()

# ---------- one object, transforms baked, origin at the back-centre ----------
bpy.ops.object.select_all(action='DESELECT')
meshes = [o for o in SIGN.objects if o.type == 'MESH']
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.join()
sign = bpy.context.view_layer.objects.active; sign.name = 'morgies_neon_sign'; sign.data.name = 'morgies_neon_sign'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.context.scene.cursor.location = (0, 0, 0)
bpy.ops.object.origin_set(type='ORIGIN_CURSOR')

# stats
tris = 0
for o in SIGN.objects:
    if o.type == 'MESH':
        me = o.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh()
        tris += sum(len(p.vertices)-2 for p in me.polygons)
print(f"SIZE  {W_*100:.1f} x {H_*100:.1f} cm   TRIANGLES {tris}")
open(os.path.join(OUT,'stats.txt'),'w').write(f"{W_:.3f} {H_:.3f} {tris}\n")

# ---------- exports (sign only) ----------
bpy.ops.object.select_all(action='DESELECT')
for o in SIGN.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'morgies_neon_sign.glb'), export_format='GLB', use_selection=True)
bpy.ops.export_scene.fbx(filepath=os.path.join(OUT,'morgies_neon_sign.fbx'), use_selection=True, object_types={'MESH'}, apply_unit_scale=True)
bpy.ops.wm.obj_export(filepath=os.path.join(OUT,'morgies_neon_sign.obj'), export_selected_objects=True, export_materials=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'morgies_neon_sign.blend'))
print("EXPORTED", sorted(os.listdir(OUT)))
