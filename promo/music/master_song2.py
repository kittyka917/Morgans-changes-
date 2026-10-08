#!/usr/bin/env python3
"""Master song2.mp3 for the showcase, keeping its one loud burst on top.

The song sits ~23 dB below its single burst at 26.39 s. A flat gain + limiter
either leaves the body inaudible or flattens the burst. So the gain is
automated: BODY dB on the body, dipping to BURST dB across the burst (the dip
starts in the near-silent gap right before it and ramps back over the decay),
The opening hit gets 8 dB less (at full body gain the limiter squares it off
and the AAC encode overshoots it to +4 dBTP). Then a limiter 2 dB under full scale catches the peaks, with headroom left so
the AAC encode can't overshoot. No compressor: it flattens the burst.
    python3 music/master_song2.py [BODY BURST]      # dB; default 20 6; the showcase uses 24 8 -> music/song2_master.wav
"""
import os, subprocess, numpy as np, soundfile as sf, librosa
here = os.path.dirname(os.path.abspath(__file__))
y, sr = librosa.load(os.path.join(here, 'song2.mp3'), sr=48000, mono=False)
n = y.shape[1]; t = np.arange(n) / sr
import sys
BODY, BURST = (float(v) for v in (sys.argv[1:3] if len(sys.argv) > 2 else (20.0, 6.0)))
g = np.full(n, BODY)
g = np.where(t < 0.10, BODY - 8, np.where(t < 0.20, BODY - 8 + 8 * (t - 0.10) / 0.10, g))         # the opening hit: under the limiter, not crushed by it
g = np.where((t >= 26.370) & (t < 26.385), BODY + (BURST - BODY) * (t - 26.370) / 0.015, g)   # dip in the gap before it
g = np.where((t >= 26.385) & (t < 26.90), BURST, g)
g = np.where((t >= 26.90) & (t < 27.30), BURST + (BODY - BURST) * (t - 26.90) / 0.40, g)         # back up over the decay
y = y * 10 ** (g / 20)
y[:, :int(0.020*sr)] *= np.linspace(0, 1, int(0.020*sr))                                         # 20 ms fade-in: a hard start makes the AAC encode overshoot
tmp = os.path.join(here, 'song2_gain.wav'); sf.write(tmp, y.T, sr, subtype='FLOAT')
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', tmp, '-af',
    'alimiter=limit=0.79:attack=1:release=60:level=false,afade=t=out:st=32.2:d=0.6',
    '-c:a', 'pcm_s24le', os.path.join(here, 'song2_master.wav')], check=True)
os.remove(tmp)
print('song2_master.wav written')
