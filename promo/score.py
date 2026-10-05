#!/usr/bin/env python3
"""
Synthesises the MAINSTREET-RP promo music bed: 120 BPM, A minor, 38.0s.
Cuts land on bar lines (every 2.0s), so impacts are placed there too.
Writes score.wav (44.1kHz 16-bit stereo).
"""
import math, struct, random
from array import array

SR   = 44100
DUR  = 36.0
BPM  = 120.0
BEAT = 60.0 / BPM          # 0.5s
BAR  = BEAT * 4            # 2.0s
N    = int(SR * DUR)

L = [0.0] * N
R = [0.0] * N
rng = random.Random(20251005)

def idx(t): return max(0, min(N - 1, int(t * SR)))

def add(buf, t0, samples, gain=1.0):
    i = idx(t0)
    for k, v in enumerate(samples):
        j = i + k
        if j >= N: break
        buf[j] += v * gain

# ---------- voices ----------
def kick(dur=0.34, f0=135.0, f1=44.0, drive=1.9):
    n = int(dur * SR); out = [0.0]*n; ph = 0.0
    for i in range(n):
        p = i / n
        f = f1 + (f0 - f1) * math.exp(-p * 9.0)
        ph += 2*math.pi*f/SR
        env = math.exp(-p * 7.0)
        click = math.exp(-p * 220.0) * 0.5
        out[i] = math.tanh(math.sin(ph) * drive) * env + click
    return out

def sub(dur, freq, atk=0.01, rel=0.25, shape=0.0):
    n = int(dur*SR); out=[0.0]*n; ph=0.0
    for i in range(n):
        t = i/SR; p = i/n
        ph += 2*math.pi*freq/SR
        s = math.sin(ph) + shape*0.30*math.sin(ph*2)
        env = min(1.0, t/atk) * math.exp(-p*rel*6.0)
        out[i] = s*env
    return out

def noise_hit(dur, decay=16.0, lp=0.35):
    n = int(dur*SR); out=[0.0]*n; z=0.0
    for i in range(n):
        p = i/n
        w = rng.uniform(-1,1)
        z += (w - z) * lp                     # one-pole lowpass
        out[i] = z * math.exp(-p*decay)
    return out

def impact(dur=1.9):
    """Boom: sub drop + filtered noise tail."""
    n = int(dur*SR); out=[0.0]*n; ph=0.0; z=0.0
    for i in range(n):
        p = i/n
        f = 38.0 + 95.0*math.exp(-p*12.0)
        ph += 2*math.pi*f/SR
        body = math.tanh(math.sin(ph)*2.3) * math.exp(-p*3.2)
        w = rng.uniform(-1,1); z += (w-z)*0.06
        tail = z * math.exp(-p*4.5) * 0.55
        out[i] = body*0.85 + tail
    return out

def hat(dur=0.055, decay=42.0):
    n=int(dur*SR); out=[0.0]*n; z=0.0; prev=0.0
    for i in range(n):
        p=i/n; w=rng.uniform(-1,1)
        z += (w-z)*0.75
        hp = z - prev; prev = z              # crude highpass
        out[i] = hp*math.exp(-p*decay)
    return out

def pluck(dur, freq, decay=5.0, sawn=7):
    """Band-limited saw-ish pluck."""
    n=int(dur*SR); out=[0.0]*n
    for i in range(n):
        t=i/SR; p=i/n
        s=0.0
        for h in range(1, sawn+1):
            s += math.sin(2*math.pi*freq*h*t)/h
        env = (1-math.exp(-t*280.0)) * math.exp(-p*decay)
        out[i] = s*0.45*env
    return out

def riser(t0, dur):
    """Noise + rising tone sweep into a cut."""
    n=int(dur*SR); out=[0.0]*n; z=0.0; ph=0.0
    for i in range(n):
        p=i/n
        w=rng.uniform(-1,1)
        z += (w-z)*(0.02 + 0.35*p*p)          # filter opens
        f = 220.0*math.pow(2.0, p*2.4)
        ph += 2*math.pi*f/SR
        out[i] = (z*0.8 + math.sin(ph)*0.22) * (p**2.2)
    return out

# ---------- arrangement ----------
# A minor. A1=55. Chord roots per 8-bar section.
A1 = 55.0
roots = {0:A1, 1:A1, 2:A1*(2**(ature:=0)) }  # placeholder replaced below
def semi(base, n): return base * (2 ** (n/12.0))

# Section roots by time (t_start, root semitone offset from A)
sections = [(0,0), (6,0), (10,-4), (14,3), (18,-4), (22,5), (26,0), (30,0)]
def root_at(t):
    r = 0
    for st, off in sections:
        if t >= st: r = off
    return semi(A1, r)

CUTS = [2.0, 6.0, 10.0, 14.0, 18.0, 22.0, 26.0, 30.0]

# --- drone (whole piece) ---
for i in range(N):
    t = i/SR
    f = root_at(t)
    env = min(1.0, t/1.5) * min(1.0, max(0.0, (DUR - t)/3.0))
    v = (math.sin(2*math.pi*f*t)*0.55
         + math.sin(2*math.pi*f*1.4983*t)*0.22        # fifth
         + math.sin(2*math.pi*f*2*t + math.sin(t*0.7))*0.16)
    # slow tremolo
    v *= 0.85 + 0.15*math.sin(2*math.pi*0.18*t)
    L[i] += v*0.17*env
    R[i] += v*0.17*env

# --- kicks: four-on-the-floor from bar 3 (t=6) to t=32 ---
K = kick()
t = 6.0
while t < 30.0:
    g = 0.95
    if t >= 26.0: g = 1.12                     # montage pushes
    add(L, t, K, g); add(R, t, K, g)
    t += BEAT
# final downbeat
add(L, 30.0, K, 1.0); add(R, 30.0, K, 1.0)

# --- sub bass: root on beats 1 and 3.5 of each bar, from t=6 ---
bar_t = 6.0
while bar_t < 30.0:
    f = root_at(bar_t)
    s1 = sub(0.46, f, rel=0.55)
    s2 = sub(0.30, f*1.5, rel=0.9)
    add(L, bar_t, s1, 0.40); add(R, bar_t, s1, 0.40)
    add(L, bar_t + BEAT*2.5, s2, 0.22); add(R, bar_t + BEAT*2.5, s2, 0.22)
    bar_t += BAR

# --- hats: offbeat 8ths from t=10 ---
t = 10.0 + BEAT/2
while t < 29.5:
    h = hat()
    g = 0.16 if (round((t-10.0)/BEAT) % 2) else 0.10
    add(L, t, h, g*1.0); add(R, t, h, g*0.78)   # slight width
    t += BEAT
# montage double-time
t = 26.0
while t < 30.0:
    h = hat(0.04, 55.0)
    add(L, t, h, 0.12); add(R, t, h, 0.15)
    t += BEAT/2

# --- arpeggio: A minor triad figure during feature sections ---
# pattern of semitone offsets (A minor: 0,3,7,12)
pat = [0, 7, 12, 3, 12, 7, 15, 12]
for seg_start, seg_end in [(10,14), (14,18), (18,22), (22,26)]:
    base = root_at(seg_start) * 4            # up two octaves
    t = seg_start
    k = 0
    while t < seg_end - 0.01:
        f = semi(base, pat[k % len(pat)])
        pl = pluck(0.42, f, decay=6.5)
        pan = 0.5 + 0.28*math.sin(k*0.9)
        add(L, t, pl, 0.085*(1-pan*0.5)); add(R, t, pl, 0.085*(pan*0.5+0.5))
        t += BEAT/2; k += 1

# --- impacts on every cut ---
for c in CUTS:
    im = impact()
    g = 1.0
    if c in (2.0, 30.0): g = 1.25
    add(L, c, im, 0.55*g); add(R, c, im, 0.55*g)
# opening swell + end impact
add(L, 0.0, noise_hit(2.0, decay=2.0, lp=0.02), 0.30)
add(R, 0.0, noise_hit(2.0, decay=2.0, lp=0.02), 0.30)

# --- risers into the logo, the montage and the end card ---
for t0, d in [(0.6, 1.4), (24.0, 2.0), (28.6, 1.4)]:
    rs = riser(t0, d)
    add(L, t0, rs, 0.16); add(R, t0, rs, 0.16)

# --- reverse swell into every cut: the standard trailer lead-in ---
def rev_swell(dur=0.9):
    n = int(dur*SR); out=[0.0]*n; z=0.0; ph=0.0
    for i in range(n):
        p = i/n
        w = rng.uniform(-1,1)
        z += (w - z)*(0.03 + 0.30*p*p)
        f = 180.0*math.pow(2.0, p*1.8)
        ph += 2*math.pi*f/SR
        out[i] = (z*0.75 + math.sin(ph)*0.18) * (p**2.6)
    return out
for c in CUTS:
    sw = rev_swell(0.9)
    add(L, c-0.9, sw, 0.13); add(R, c-0.9, sw, 0.13)

# --- montage stabs on each word (10 words over 26..30 => 0.4s each) ---
for i in range(10):
    t = 26.0 + i*0.4
    st = noise_hit(0.22, decay=26.0, lp=0.5)
    add(L, t, st, 0.20); add(R, t, st, 0.20)

# ---------- sidechain duck on kick ----------
duck = [1.0]*N
t = 6.0
while t < 30.05:
    i0 = idx(t); span = int(0.26*SR)
    for k in range(span):
        j = i0+k
        if j >= N: break
        p = k/span
        d = 0.40 + 0.60*(1 - math.exp(-p*4.2))
        if d < duck[j]: duck[j] = d
    t += BEAT
for i in range(N):
    L[i] *= duck[i]; R[i] *= duck[i]

# ---------- master: soft clip + normalise ----------
peak = max(max(abs(v) for v in L), max(abs(v) for v in R)) or 1.0
g = 0.82 / peak
out = array('h')
for i in range(N):
    l = math.tanh(L[i]*g*1.25)*0.89
    r = math.tanh(R[i]*g*1.25)*0.89
    out.append(int(max(-32767, min(32767, l*32767))))
    out.append(int(max(-32767, min(32767, r*32767))))

data = out.tobytes()
with open('score.wav','wb') as f:
    f.write(b'RIFF' + struct.pack('<I', 36+len(data)) + b'WAVEfmt ')
    f.write(struct.pack('<IHHIIHH', 16, 1, 2, SR, SR*2*2, 4, 16))
    f.write(b'data' + struct.pack('<I', len(data)) + data)
print('score.wav written: %.2fs, peak-normalised' % DUR)
