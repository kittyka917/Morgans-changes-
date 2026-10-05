#!/usr/bin/env python3
"""
Music bed for Morgie's Gun Showcase: 26.0s, 120 BPM half-time trap in
F minor. Bars are 2.0s, matching the cuts in morgie.html (2,6,10,12,16,18,22,24);
the two biggest hits land on the claps at 11.0s and 17.0s, the frames the finish swaps.
Writes score_morgie.wav (44.1 kHz, 16-bit stereo).
"""
import math, struct, random
from array import array

SR, DUR, BEAT = 44100, 26.0, 0.5
N = int(SR*DUR)
L = [0.0]*N; R = [0.0]*N
rng = random.Random(1914)

def idx(t): return max(0, min(N-1, int(t*SR)))
def add(t0, s, gl, gr=None):
    gr = gl if gr is None else gr
    i = idx(t0)
    for k, v in enumerate(s):
        j = i+k
        if j >= N: break
        L[j] += v*gl; R[j] += v*gr
def semi(f, n): return f*(2**(n/12))

F1 = 43.65   # F1

# ---------- voices ----------
def k808(dur, f0, f1=None, glide=0.0):
    """808: sine with a pitch drop on the attack, optional glide, saturated."""
    n = int(dur*SR); out=[0.0]*n; ph=0.0
    f1 = f1 or f0
    for i in range(n):
        t = i/SR; p = i/n
        base = f0 + (f1 - f0)*min(1, t/glide) if glide > 0 else f0
        f = base*(1 + 2.2*math.exp(-t*38))          # pitch drop on the attack
        ph += 2*math.pi*f/SR
        env = min(1, t/0.003) * math.exp(-t*1.6)
        out[i] = math.tanh(math.sin(ph)*2.4)*env
    return out
def cl(v): return 0 if v < 0 else 1 if v > 1 else v

def clap(dur=0.32):
    n=int(dur*SR); out=[0.0]*n; z=0.0; prev=0.0
    for i in range(n):
        t=i/SR
        w=rng.uniform(-1,1); z += (w-z)*0.55; hp = z-prev; prev = z
        # three quick strikes then a tail, the classic clap shape
        e = sum(math.exp(-max(0,t-o)*160)*(t>=o) for o in (0,0.011,0.023)) + 0.55*math.exp(-t*14)
        out[i] = hp*e*0.9
    return out

def hat(dur=0.05, dec=60.0):
    n=int(dur*SR); out=[0.0]*n; z=0.0; prev=0.0
    for i in range(n):
        p=i/n; w=rng.uniform(-1,1); z += (w-z)*0.8; hp=z-prev; prev=z
        out[i]=hp*math.exp(-p*dec*dur*10)
    return out

def bell(dur, f):
    """Music box: inharmonic partials, fast decay — the pink, sweet layer."""
    n=int(dur*SR); out=[0.0]*n
    parts=[(1.0,1.0,3.2),(2.756,0.45,5.5),(5.404,0.22,9.0),(8.93,0.08,13.0)]
    for i in range(n):
        t=i/SR; v=0.0
        for m,a,d in parts: v += a*math.sin(2*math.pi*f*m*t)*math.exp(-t*d)
        out[i]=v*min(1,t/0.002)*0.5
    return out

def pad(dur, freqs):
    n=int(dur*SR); out=[0.0]*n
    for i in range(n):
        t=i/SR; p=i/n
        env=min(1,t/0.8)*min(1,(dur-t)/0.8)
        v=sum(math.sin(2*math.pi*f*t + 0.3*math.sin(t*0.9+j)) for j,f in enumerate(freqs))
        out[i]=v/len(freqs)*env
    return out

def impact(dur=1.8, big=1.0):
    n=int(dur*SR); out=[0.0]*n; ph=0.0; z=0.0
    for i in range(n):
        p=i/n; t=i/SR
        f=36+110*math.exp(-t*14); ph+=2*math.pi*f/SR
        body=math.tanh(math.sin(ph)*2.6)*math.exp(-t*2.6)
        w=rng.uniform(-1,1); z+=(w-z)*0.05
        out[i]=(body*0.85 + z*math.exp(-t*4)*0.6)*big
    return out

def riser(dur):
    n=int(dur*SR); out=[0.0]*n; z=0.0; ph=0.0
    for i in range(n):
        p=i/n; w=rng.uniform(-1,1); z+=(w-z)*(0.02+0.4*p*p)
        f=300*2**(p*2.2); ph+=2*math.pi*f/SR
        out[i]=(z*0.8+math.sin(ph)*0.2)*(p**2.4)
    return out

def rev_swell(dur=0.9):
    n=int(dur*SR); out=[0.0]*n; z=0.0
    for i in range(n):
        p=i/n; w=rng.uniform(-1,1); z+=(w-z)*(0.03+0.3*p*p)
        out[i]=z*(p**2.6)
    return out

# ---------- arrangement ----------
# chords per bar (semitones from F): Fm, Db, Ab, Eb  — a sweet, dark loop
PROG = [0, -4, 3, -2]
def root(bar): return PROG[bar % 4]

# pad underneath everything
for b in range(13):
    r = root(b); base = semi(F1*4, r)
    add(b*2.0, pad(2.05, [base, base*1.189, base*1.498]), 0.08, 0.08)

# music-box arpeggio, Fm pentatonic-ish figure, whole track, thinner in the intro
fig = [12, 15, 19, 24, 19, 15, 22, 19]
for b in range(13):
    for k in range(8):
        t = b*2.0 + k*0.25
        if t >= 25.5: break
        if b == 0 and k % 2: continue
        f = semi(F1*16, root(b) + fig[k])
        pan = 0.5 + 0.35*math.sin(k*1.3 + b)
        g = 0.17 if b else 0.14
        add(t, bell(0.9, f), g*(1.2-pan), g*(0.2+pan))

# drums enter on the 2.0s hit; drop out for the end card at 18.0
DRUM0, DRUM1 = 2.0, 24.0
bar = DRUM0
while bar < DRUM1 - 0.01:
    b = int(bar/2)
    f = semi(F1, root(b))
    # 808 on 1, and on the "and-a" of 2; glide into the next bar on the turnaround
    add(bar,        k808(1.2, f), 0.55)
    add(bar + 0.75, k808(0.7, f), 0.40)
    if b % 2 == 1: add(bar + 1.5, k808(0.5, f, semi(F1, root(b+1)), glide=0.35), 0.38)
    # clap on 3 (half-time feel)
    add(bar + 1.0, clap(), 0.42)
    # hats: eighths, with 1/16 and 1/32 rolls on the last beat
    for k in range(8):
        add(bar + k*0.25, hat(), 0.10 if k % 2 else 0.14, 0.12 if k % 2 else 0.10)
    if b % 2 == 1:
        for k in range(8): add(bar + 1.5 + k*0.0625, hat(0.03), 0.07+0.01*k)
    bar += 2.0

# build into the swap: hat roll accelerates 10.0 -> 11.0, riser, then the drop
t = 10.0; step = 0.125
while t < 11.0:
    add(t, hat(0.03), 0.13); t += step; step = max(0.03125, step*0.86)
add(9.6, riser(1.4), 0.20)
t = 16.0; step = 0.125
while t < 17.0:
    add(t, hat(0.03), 0.13); t += step; step = max(0.03125, step*0.86)
add(15.6, riser(1.4), 0.22)

# impacts on the cuts, the swap hardest
for c, g in [(2.0,1.0), (6.0,0.6), (10.0,0.5), (11.0,1.35), (16.0,0.5), (17.0,1.4), (22.0,0.7), (24.0,1.0)]:
    add(c, impact(big=g), 0.50)
for c in [2.0, 11.0, 17.0, 24.0]:
    add(c-0.9, rev_swell(0.9), 0.14)
# strobe ticks in the cold open (matching STROBES in glock.html)
for s in [0.30, 0.78, 1.22, 1.62]:
    add(s, clap(0.12), 0.16)

# sidechain duck from the 808 downbeats
duck=[1.0]*N
bar = DRUM0
while bar < DRUM1:
    for off in (0.0, 0.75):
        i0=idx(bar+off); span=int(0.22*SR)
        for k in range(span):
            j=i0+k
            if j>=N: break
            d=0.55+0.45*(1-math.exp(-(k/span)*4))
            duck[j]=min(duck[j],d)
    bar += 2.0
# the duck only applies to the melodic layers — approximate by ducking all, gently
for i in range(N): L[i]*=duck[i]; R[i]*=duck[i]

# fade the last half second
for i in range(idx(25.5), N):
    g = 1 - (i-idx(25.5))/(N-idx(25.5)); L[i]*=g; R[i]*=g

peak = max(max(abs(v) for v in L), max(abs(v) for v in R)) or 1
g = 0.85/peak
out = array('h')
for i in range(N):
    out.append(int(max(-32767,min(32767, math.tanh(L[i]*g*1.2)*0.9*32767))))
    out.append(int(max(-32767,min(32767, math.tanh(R[i]*g*1.2)*0.9*32767))))
data = out.tobytes()
with open('score_morgie.wav','wb') as f:
    f.write(b'RIFF'+struct.pack('<I',36+len(data))+b'WAVEfmt ')
    f.write(struct.pack('<IHHIIHH',16,1,2,SR,SR*4,4,16))
    f.write(b'data'+struct.pack('<I',len(data))+data)
print('score_morgie.wav written: %.1fs' % DUR)
