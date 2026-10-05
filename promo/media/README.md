# Drop your city footage and screenshots here

The promo renders fine with nothing in this folder — every slot has a designed
graphic fallback. Add files and they take over automatically on the next
`node build.js`. Nothing else needs editing.

## The easy way — just dump your clips

Drop any number of Medal clips into `media/clips/` and run the build. No
renaming, no trimming. It takes the **newest clips from the last 35 days**,
hands them out to the strongest slots first (end card, hero, events, crew,
hook, montage, identity, care), and pulls a few seconds from inside each one
rather than from the opening frames.

```bash
node build.js                 # auto-assigns whatever is in media/clips/
CLIP_DAYS=90 node build.js    # widen the window if you want older clips
```

**Clip audio is never used.** The ingest extracts picture frames only — there
is no audio path from your clips into the film at all.

To pin a specific clip to a specific slot, name it for that slot and put it in
`media/` directly (see below). Named files always beat auto-assignment.

## Naming (optional — for pinning a clip to a slot)

Name each file for the slot it fills: `<slot>-anything.<ext>`

| Slot | Where it lands | Length needed | What works best |
|---|---|---|---|
| `hero` | 0:02, behind the badge | 4s | A wide, slow establishing shot of the city at night |
| `hook` | 0:06, behind "it's who's in it" | 4s | People — a busy street, a crowd, a meet |
| `identity` | 0:10, behind the wardrobe grid | 4s | Clothing store, barber, someone changing fit |
| `crew` | 0:14, behind the party banner | 4s | A group rolling together, convoy, crew standing around |
| `events` | 0:18, behind the event panels | 4s | AFL showcase, an airdrop fight, a packed event |
| `care` | 0:22, behind the ECG | 4s | A downed player, medic arriving, EMS on scene |
| `montage` | 0:26, behind the fast cuts | 4s | Anything energetic — it plays under 10 quick cards |
| `end` | 0:30, behind the end card | 6s | Your best-looking wide shot, slow and steady |

Extensions: `.mp4`, `.mov`, `.webm` for clips; `.jpg`, `.png`, `.webp` for stills.
A still gets a slow push instead of sitting dead on screen.

## What to shoot

- **Record at 1920x1080 or higher, 30fps or better.** Anything smaller gets
  upscaled and will look soft next to the graphics.
- **Hide your HUD and chat** if you can. The promo draws its own HUD furniture,
  and two sets of UI on screen at once looks amateur.
- **Slow, steady camera.** Orbits and gentle pushes cut well. Fast mouse-look
  does not.
- **Night and wet streets** match the grade best — the piece is graded toward
  the badge's green, and neon and reflections carry that beautifully.
- **A few seconds longer than you need.** Extra handles make it easier to pick
  the best window.

Clips are auto-cropped to 16:9 and graded to match, so they don't need to be
colour-corrected first.

## Then

```bash
node build.js     # ingests media, re-extracts frames, re-renders
```

The ingest caches extracted frames in `_cache/`, which is gitignored. Delete
that folder to force a re-ingest.
