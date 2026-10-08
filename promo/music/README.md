# Music

`morgie.html` is cut to the song in this folder, which stays out of git.
Put it here as `song.mp3` (the original is a 34.97s Medal clip, MP3 192 kbps,
48 kHz stereo).

It was recorded quietly (-34.8 LUFS, peaks at -21.6 dBFS, noise floor around
-71 dBFS), so it's mastered before muxing: trimmed to the video's 34.95s,
faded over the last 1.2s (it ends mid-phrase), and loudness-normalised in two
passes to -14 LUFS with a -1 dB true-peak ceiling.

```bash
# pass 1: measure
ffmpeg -i song.mp3 -af "atrim=0:34.95,afade=t=out:st=33.75:d=1.2,loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json" -f null -
# pass 2: apply, with pass 1's input_i / input_tp / input_lra / input_thresh / target_offset
ffmpeg -y -i song.mp3 -af "atrim=0:34.95,afade=t=out:st=33.75:d=1.2,loudnorm=I=-14:TP=-1.0:LRA=11:measured_i=-34.78:measured_tp=-21.60:measured_lra=5.70:measured_thresh=-45.08:offset=-1.29:linear=true,aresample=48000" -c:a pcm_s24le song_master.wav
```

Result: -13.9 LUFS integrated, -1.0 dBFS peak.

If you swap in a different song, re-measure its beat grid and update
`BEAT0` / `BEAT` in `morgie.html` — every cut is placed from those two numbers.

## Extended edit (showcase.html)

`showcase.html` runs 55.5 s, longer than the song, so `extend.py` builds an
extended edit from the song's own parts: start → bar 19 (33.954 s), then back
to the break at bar 7 (13.386 s) → end, crossfaded over 12 ms on the bar line.
The beat grid carries straight through (onset strength on the grid: 0.94 before
the join, 0.95 after). Master it the same way, with the fade at 54.3 s:

```bash
python3 extend.py
# pass 1 / pass 2 as above, with atrim=0:55.5,afade=t=out:st=54.3:d=1.2 -> song_extended_master.wav
```

Result: -14.0 LUFS, -1.1 dBFS peak.

## Song 2 (`song2.mp3`, the current showcase)

A 32.8 s instrumental (no speech: checked with showtime's transcriber). Measured
with librosa: a tick every 0.333 s from 0.050 s, in ~1 s cycles of three; an
energetic intro to ~8 s, a quiet break 8–15 s, a build 15–26 s, **one loud burst
at 26.39 s** (peaks 26.42 / 26.53 s) and a quiet tail.

As delivered it measures -25 LUFS with a 29 LU range: the burst sits ~23 dB
above the rest, so plain loudness normalisation stops at -24 LUFS. A
compressor lifts the body but flattens the burst, so `master_song2.py` automates
the gain instead: +24 dB on the body, dipping to +8 dB across the burst (the dip
starts in the near-silent gap just before it, then ramps back over the decay).
The opening hit gets 8 dB less, with a 20 ms fade-in: at full gain the limiter
squared it off and the AAC encode overshot it to +4.1 dBTP. A limiter at
-2 dBFS (0.79) catches the peaks and leaves headroom for the AAC encode.

```bash
python3 master_song2.py 24 8      # BODY BURST in dB -> song2_master.wav
```

Result: -19.0 LUFS, -1.8 dBTP after the AAC encode, no clipping, burst +3.2 dB
over the build. It is quieter than -14 on purpose. Louder settings trade the
burst away:

| BODY / BURST | Loudness | Burst over build |
|---|---|---|
| +22 / +7 | -20.3 LUFS | +5.7 dB |
| +24 / +8 | -19.0 LUFS | +3.2 dB |
| +26 / +9 | -17.8 LUFS | +2.3 dB |
