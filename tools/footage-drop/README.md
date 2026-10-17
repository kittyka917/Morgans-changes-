# Footage Drop

Morgan's upload page for videos bigger than the chat's attachment limit:
**https://claude.ai/artifact/P3RuJWGNrSBA3seiBJAxfB** (private to Morgan).

`footage-drop.html` is the page's source. Republish it from this path with the
Artifact tool, passing that URL, to keep the link. It declares the `db` and
`assets` capabilities.

## How it works

The page's asset store takes at most 20 MiB per file, so the page cuts each
video into parts of about 19 MiB:

- **Cutting:** a cut point never lands on a blank byte or `<`, because the
  store refuses binary files that start with markup.
- **Checks:** the page hashes each part with SHA-256 and uploads it as
  `video/mp4`, then checks that the stored size matches.
- **Manifest:** one document per video lives in the page's `uploads`
  collection. It holds `name`, `size`, `note`, `complete`, and for each part
  `i`, `start`, `end`, `sha256` and its asset `id`.
- **Resuming:** an interrupted upload carries on when Morgan picks the same
  file again. The cut points are fixed per file, and only the missing parts go
  up.

When an upload is done, Morgan presses **Copy request** and pastes it into the
chat, for example `Footage Drop upload <doc id> (clip.mp4): funny edit`.

## Fetching an upload (for Claude)

1. Read the manifest. Use `ArtifactData` with `action: "get"`, the URL above,
   `collection: "uploads"` and the doc id. Add `out_dir` to save it as JSON.
2. Download the parts. Use `Artifact` with `action: "read"`, the URL, and
   `paths` set to every part `id` (up to 256 per call). Each part is saved as
   `<id>.mp4`.
3. Rebuild and verify. Run
   `python3 tools/footage-drop/join.py MANIFEST.json PARTS_DIR OUT.mp4`.
   It checks every part's length and SHA-256 and the total size, writes the
   file only if everything matches, and never leaves a partial file behind.
4. Work on `OUT.mp4`. Never edit the parts or delete an upload unless Morgan
   asks.

## Tested

- **Page logic:** parts are contiguous, cover the whole file and stay under
  20 MiB, including when the natural cut points are planted with `<` and
  spaces.
- **`join.py`:** a rebuilt file is byte-identical to the original; a corrupted
  part or a missing part stops it, and no file is written.
- **Store round trip:** a 19 MiB slice cut from the middle of an MP4 (no
  header) was accepted as `video/mp4`, read back by its id, and its SHA-256
  matched.
