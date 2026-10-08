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
