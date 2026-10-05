"""Animate the MORGIE'S neon sign as a seamless 3-second loop.

render_sign.py ... passes writes one EXR with a light group per letter, the
blossom, the halo light and the world. Light adds linearly, so every frame is
an exact re-light of that one render: frame = sum(weight_i(t) * group_i).
Here: denoise each group (OIDN, albedo + normal guided), animate the weights
(mains hum, a flickering E, a sputtering apostrophe, a breathing blossom), add
bloom, tone-map with Blender's own AgX + Punchy (OCIO), and write frames plus a
matching electrical hum. Every motion repeats on whole cycles of the loop, so
frame N wraps to frame 0 with no seam.

    python loop.py PASSES.exr OUTDIR
"""
import sys, os, math, wave
import numpy as np, OpenEXR, cv2, pyoidn
import PyOpenColorIO as OCIO
import bpy  # only for the path to Blender's OCIO config

EXR, OUT = sys.argv[1], sys.argv[2]
FPS, SECONDS = 30, 3
N = FPS * SECONDS
LETTERS = 8                     # M O R G I E ' S
E, APOS = 5, 6
os.makedirs(os.path.join(OUT, 'frames'), exist_ok=True)

# ---------- passes, denoised once and cached ----------
cache = os.path.join(OUT, 'groups.npz')
GROUPS = ['L%d' % i for i in range(LETTERS)] + ['blossom', 'halo', 'amb']
if os.path.exists(cache):
    G = dict(np.load(cache))
else:
    f = OpenEXR.File(EXR, separate_channels=False)
    d = {k.replace('ViewLayer.', ''): c.pixels for p in f.parts for k, c in p.channels.items()}
    albedo = np.ascontiguousarray(d['Denoising Albedo'][..., :3], np.float32)
    normal = np.ascontiguousarray(np.stack([d['Denoising Normal.%s' % a] for a in 'XYZ'], -1), np.float32)
    G = {}
    with pyoidn.Device() as dev:
        dev.commit()
        for g in GROUPS:
            col = np.ascontiguousarray(d['Combined_' + g][..., :3], np.float32)
            res = np.zeros_like(col)
            with pyoidn.Filter(dev, pyoidn.OIDN_FILTER_TYPE_RT) as flt:
                flt.set_image(pyoidn.OIDN_IMAGE_COLOR, col, pyoidn.OIDN_FORMAT_FLOAT3)
                flt.set_image(pyoidn.OIDN_IMAGE_ALBEDO, albedo, pyoidn.OIDN_FORMAT_FLOAT3)
                flt.set_image(pyoidn.OIDN_IMAGE_NORMAL, normal, pyoidn.OIDN_FORMAT_FLOAT3)
                flt.set_image(pyoidn.OIDN_IMAGE_OUTPUT, res, pyoidn.OIDN_FORMAT_FLOAT3)
                flt.set_bool('hdr', True)
                flt.set_quality(pyoidn.OIDN_QUALITY_HIGH)
                flt.commit(); flt.execute()
            assert dev.get_error() is None, dev.get_error()
            G[g] = np.maximum(res, 0)
            print('denoised', g, flush=True)
    np.savez(cache, **G)
H, W = G['amb'].shape[:2]

# ---------- animation: weights per frame ----------
def hashf(i, salt):             # deterministic per-frame noise in [-1, 1]
    x = math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
    return 2 * (x - math.floor(x)) - 1

# The E: a bad transformer. Values are its brightness on those frames.
E_FLICK = {40: .35, 41: .95, 42: .10, 43: .04, 44: .04, 45: .04, 46: .60, 47: 1, 48: 1,
           49: .22, 50: .06, 51: .75, 52: .30, 53: .92}
APOS_FLICK = {74: .45, 75: .08, 76: .85}

def weights(i):
    t = i / N
    hum = 1 + .010 * math.sin(2 * math.pi * 5 * t) + .006 * math.sin(2 * math.pi * 11 * t + .7) + .008 * hashf(i, 1)
    w = {'L%d' % k: hum for k in range(LETTERS)}
    w['L%d' % E] = hum * E_FLICK.get(i, 1.0)
    w['L%d' % APOS] = hum * APOS_FLICK.get(i, 1.0)
    w['blossom'] = (.80 + .20 * .5 * (1 + math.cos(2 * math.pi * t))) * (1 + .006 * hashf(i, 2))
    w['amb'] = 1.0
    return w

# the halo light stands in for the whole sign's spill, so it follows the letters' total
LUM = np.array([G['L%d' % k].mean() for k in range(LETTERS)])
def halo(w):
    return float(sum(w['L%d' % k] * LUM[k] for k in range(LETTERS)) / LUM.sum())

# ---------- look ----------
cfg = OCIO.Config.CreateFromFile(os.path.join(os.path.dirname(bpy.__file__), '..', '..', '..', 'datafiles', 'colormanagement', 'config.ocio'))
vp = OCIO.LegacyViewingPipeline()
vp.setDisplayViewTransform(OCIO.DisplayViewTransform(src='Linear Rec.709', display='sRGB', view='AgX'))
vp.setLooksOverride('AgX - Punchy'); vp.setLooksOverrideEnabled(True)
cpu = vp.getProcessor(cfg).getDefaultCPUProcessor()

SIG = [W * s for s in (.004, .011, .028, .065)]     # bloom radii, as a share of frame width
BW = [.40, .30, .20, .10]
def bloom(lin):
    b = np.maximum(lin - .9, 0)
    small = cv2.resize(b, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
    acc = np.zeros_like(small)
    for s, k in zip(SIG, BW):
        acc += k * cv2.GaussianBlur(small, (0, 0), s / 4)
    return lin + .55 * cv2.resize(acc, (W, H), interpolation=cv2.INTER_LINEAR)

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
VIG = (1 - .22 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2) / 2)[..., None]

def frame(i):
    w = weights(i); w['halo'] = halo(w)
    lin = sum(w[g] * G[g] for g in GROUPS).astype(np.float32)
    img = np.ascontiguousarray(bloom(lin) * VIG, np.float32)
    cpu.applyRGB(img)
    rng = np.random.default_rng(i)
    img = img + rng.normal(0, 1.2 / 255, img.shape[:2])[..., None]   # fine grain; also dithers the dark gradients
    return np.clip(img * 255 + .5, 0, 255).astype(np.uint8), w

LOG = []
for i in range(N):
    px, w = frame(i)
    cv2.imwrite(os.path.join(OUT, 'frames', 'f%03d.png' % i), px[..., ::-1])
    LOG.append(sum(w['L%d' % k] * LUM[k] for k in range(LETTERS)) / LUM.sum())
print('frames done', N, W, H, flush=True)

# ---------- sound: mains hum + a crackle wherever a tube drops out ----------
SR = 48000
n = SR * SECONDS
t = np.arange(n) / SR
lvl = np.interp(t * FPS, np.arange(N + 1), LOG + LOG[:1])           # brightness, per sample, wrapping
hum = sum(a * np.sin(2 * np.pi * f * t + p) for f, a, p in ((120, .50, 0), (240, .28, .4), (360, .16, 1.1), (480, .08, 2.0), (600, .05, .3)))
hum *= .06 * (.55 + .45 * lvl)
rng = np.random.default_rng(7)
crack = np.zeros(n)
for flick in (E_FLICK, APOS_FLICK):
    prev = 1.0
    for fi in sorted(flick):
        dv = abs(flick[fi] - prev); prev = flick[fi]
        if dv < .1: continue
        s0 = int(fi / FPS * SR); L = int(.035 * SR)
        burst = rng.normal(0, 1, L) * np.exp(-np.arange(L) / (.006 * SR))
        burst = np.convolve(burst, [1, -1], 'same')                    # thin it out: a crackle, not a thump
        crack[s0:s0 + L] += .16 * dv * burst[:max(0, min(L, n - s0))]
air = np.convolve(rng.normal(0, 1, n), np.ones(24) / 24, 'same') * .004
mix = hum + crack + air
mix = mix / max(1e-9, np.abs(mix).max()) * .5
pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
with wave.open(os.path.join(OUT, 'hum.wav'), 'wb') as wf:
    wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(SR); wf.writeframes(pcm.tobytes())
print('audio done')
