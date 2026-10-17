#!/usr/bin/env python3
"""Rebuild a Footage Drop upload from its parts and prove it is byte-exact.

The Footage Drop page stores a video as ~19 MB parts (asset ids) and keeps a
manifest in its `uploads` collection: name, size, and per part its byte range
and SHA-256. Claude reads that manifest (ArtifactData list/get), downloads each
part (Artifact read with `paths` = the part ids), then runs:

    python3 join.py MANIFEST.json PARTS_DIR OUT_FILE

MANIFEST.json is the upload document (the object with `name`, `size`, `parts`).
PARTS_DIR holds the downloaded parts, each named by its asset id with any
extension. Every part is checked for length and SHA-256 before it is written,
and the result must match the manifest's total size, or nothing is kept.
"""
import hashlib, json, os, sys


def main():
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    man_path, parts_dir, out = sys.argv[1:]
    man = json.load(open(man_path))
    man = man.get('data', man)                 # accept a raw ArtifactData row too
    parts = sorted(man['parts'], key=lambda p: p['i'])
    if not man.get('complete') or any(not p.get('id') for p in parts):
        sys.exit('upload is not complete: %d of %d parts stored' % (sum(1 for p in parts if p.get('id')), len(parts)))
    files = {os.path.splitext(f)[0]: os.path.join(parts_dir, f) for f in os.listdir(parts_dir)}
    tmp = out + '.partial'
    try:
        build(parts, files, parts_dir, tmp, man['size'])
    except BaseException:
        if os.path.exists(tmp):
            os.remove(tmp)                      # never leave a half-built file behind
        raise
    os.replace(tmp, out)
    print('rebuilt %s: %d bytes from %d parts, every checksum matched' % (out, man['size'], len(parts)))


def build(parts, files, parts_dir, tmp, size):
    pos = 0
    with open(tmp, 'wb') as w:
        for p in parts:
            if p['start'] != pos:
                sys.exit('gap before part %d: expected byte %d, manifest says %d' % (p['i'] + 1, pos, p['start']))
            path = files.get(p['id'])
            if not path:
                sys.exit('part %d (%s) is not in %s' % (p['i'] + 1, p['id'], parts_dir))
            data = open(path, 'rb').read()
            if len(data) != p['end'] - p['start']:
                sys.exit('part %d is %d bytes, expected %d' % (p['i'] + 1, len(data), p['end'] - p['start']))
            if hashlib.sha256(data).hexdigest() != p['sha256']:
                sys.exit('part %d checksum does not match' % (p['i'] + 1))
            w.write(data)
            pos = p['end']
    if pos != size or os.path.getsize(tmp) != size:
        sys.exit('rebuilt %d bytes, expected %d' % (pos, size))


if __name__ == '__main__':
    main()
