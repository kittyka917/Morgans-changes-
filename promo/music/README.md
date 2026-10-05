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
