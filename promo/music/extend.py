#!/usr/bin/env python3
"""Extend the song for showcase.html on its own bar grid.

Plays song.mp3 from the start to bar 19 (33.954 s), then jumps back to the
break at bar 7 (13.386 s) and plays to the end, joined with a 12 ms
equal-power crossfade on the bar line: two drops, 55.5 s, no break in the beat.
Grid (measured with librosa): a beat every 0.4285 s from 1.388 s, bars of 4.

    python3 music/extend.py            # writes music/song_extended.wav
Then master it as in music/README.md (fade from 54.3 s, two-pass loudnorm).
"""
import os, numpy as np, soundfile as sf, librosa
here = os.path.dirname(os.path.abspath(__file__))
y, sr = librosa.load(os.path.join(here, 'song.mp3'), sr=48000, mono=False)
B0, BT = 1.388, 0.4285
BAR = lambda b: B0 + 4*BT*b
a_end, b_start = int(round(BAR(19)*sr)), int(round(BAR(7)*sr))
X = int(0.012*sr)
A, B = y[:, :a_end + X//2], y[:, b_start - X//2:]
th = np.linspace(0, np.pi/2, X)
out = np.concatenate([A[:, :-X], A[:, -X:]*np.cos(th) + B[:, :X]*np.sin(th), B[:, X:]], axis=1)
sf.write(os.path.join(here, 'song_extended.wav'), out.T, sr, subtype='PCM_24')
print('song_extended.wav: %.3f s' % (out.shape[1]/sr))
