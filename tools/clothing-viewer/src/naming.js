// Groups loose clothing files into drawables with their texture variants.
//
// Ped component naming (CodeWalker MCPVDrawblData.GetDrawableName / GetTextureName):
//   drawable: {comp}_{NNN}_{u|r|m}[_{alt}]          e.g. jbib_000_u.ydd
//   texture:  {comp}_diff_{NNN}_{a..z}_{race}       e.g. jbib_diff_000_a_uni.ytd
// FiveM add-on packs usually prefix files with a collection name and '^',
//   e.g. mp_m_freemode_01_mybrand^jbib_000_u.ydd
// Props follow p_{anchor}_{NNN}.ydd / p_{anchor}_diff_{NNN}_{letter}[...].ytd.

// Component slot order is the component ID (CodeWalker MCPVComponentData.ComponentTypeNames).
export const COMPONENTS = [
  { key: 'head', id: 0, label: 'Head' },
  { key: 'berd', id: 1, label: 'Masks' },
  { key: 'hair', id: 2, label: 'Hair' },
  { key: 'uppr', id: 3, label: 'Torso / arms' },
  { key: 'lowr', id: 4, label: 'Legs' },
  { key: 'hand', id: 5, label: 'Bags' },
  { key: 'feet', id: 6, label: 'Shoes' },
  { key: 'teef', id: 7, label: 'Accessories' },
  { key: 'accs', id: 8, label: 'Undershirts' },
  { key: 'task', id: 9, label: 'Body armour' },
  { key: 'decl', id: 10, label: 'Decals' },
  { key: 'jbib', id: 11, label: 'Tops' },
];
const COMPONENT_BY_KEY = Object.fromEntries(COMPONENTS.map((c) => [c.key, c]));

// Prop anchors with well-known file prefixes; any other p_* prefix is still accepted.
const PROP_LABELS = { head: 'Hats', eyes: 'Glasses', ears: 'Ears', lwrist: 'Watches', rwrist: 'Bracelets' };

const COMP_KEYS = COMPONENTS.map((c) => c.key).join('|');
const RE_COMP_DRAWABLE = new RegExp(`^(${COMP_KEYS})_(\\d{3})_([a-z])(?:_(\\d+))?$`);
const RE_COMP_TEXTURE = new RegExp(`^(${COMP_KEYS})_diff_(\\d{3})_([a-z])(?:_([a-z]+))?$`);
const RE_PROP_DRAWABLE = /^p_([a-z]+)_(\d{3})(?:_(\d+))?$/;
const RE_PROP_TEXTURE = /^p_([a-z]+)_diff_(\d{3})_([a-z])(?:_([a-z]+))?$/;

export const RACE_LABELS = {
  uni: 'universal', whi: 'white', bla: 'black', chi: 'chinese', lat: 'latino', ara: 'arab', kor: 'korean', pak: 'pakistani',
};

// Splits "folder/sub/prefix^name.ext" into its parts.
export function splitPath(path) {
  const parts = path.replace(/\\/g, '/').split('/');
  const file = parts.pop();
  const dot = file.lastIndexOf('.');
  const ext = dot >= 0 ? file.slice(dot + 1).toLowerCase() : '';
  const stem = dot >= 0 ? file.slice(0, dot) : file;
  const caret = stem.lastIndexOf('^');
  return {
    folder: parts.join('/'),
    file,
    ext,
    prefix: caret >= 0 ? stem.slice(0, caret) : '',
    name: (caret >= 0 ? stem.slice(caret + 1) : stem).toLowerCase(),
  };
}

// Classifies one file. Returns null for files the viewer doesn't use.
export function classify(path) {
  const p = splitPath(path);
  if (p.ext !== 'ydd' && p.ext !== 'ytd') return null;
  const collection = p.prefix || p.folder || '(root)';
  let m;
  if (p.ext === 'ydd') {
    if ((m = RE_COMP_DRAWABLE.exec(p.name))) {
      return { ...p, collection, kind: 'drawable', slot: m[1], isProp: false, index: +m[2], variant: m[3], alt: m[4] ? +m[4] : 0 };
    }
    if ((m = RE_PROP_DRAWABLE.exec(p.name))) {
      return { ...p, collection, kind: 'drawable', slot: `p_${m[1]}`, isProp: true, index: +m[2], variant: '', alt: m[3] ? +m[3] : 0 };
    }
    return { ...p, collection, kind: 'drawable', slot: null, isProp: false, index: -1 };
  }
  if ((m = RE_COMP_TEXTURE.exec(p.name))) {
    return { ...p, collection, kind: 'texture', slot: m[1], isProp: false, index: +m[2], letter: m[3], race: m[4] || '' };
  }
  if ((m = RE_PROP_TEXTURE.exec(p.name))) {
    return { ...p, collection, kind: 'texture', slot: `p_${m[1]}`, isProp: true, index: +m[2], letter: m[3], race: m[4] || '' };
  }
  return { ...p, collection, kind: 'texture', slot: null, isProp: false, index: -1 };
}

export function slotInfo(slot) {
  if (!slot) return { key: 'other', label: 'Other models', order: 1000 };
  if (slot.startsWith('p_')) {
    const anchor = slot.slice(2);
    return { key: slot, label: `${PROP_LABELS[anchor] || anchor} (prop)`, order: 100 + anchor.charCodeAt(0) };
  }
  const c = COMPONENT_BY_KEY[slot];
  return { key: slot, label: c.label, id: c.id, order: c.id };
}

// Builds the browse tree from a list of { path, file } entries (file = File/Blob).
// Returns { collections: [{ name, slots: [{ key, label, items: [item] }] }], looseTextures: [entry] }
// where item = { id, name, drawable: entry, textures: [entry] }.
export function buildCatalog(entries) {
  const drawables = [];
  const textures = [];
  for (const e of entries) {
    const info = classify(e.path);
    if (!info) continue;
    (info.kind === 'drawable' ? drawables : textures).push({ ...e, info });
  }

  const texKey = (i) => `${i.collection}|${i.slot}|${i.index}`;
  const texByKey = new Map();
  for (const t of textures) {
    if (!t.info.slot) continue;
    const k = texKey(t.info);
    if (!texByKey.has(k)) texByKey.set(k, []);
    texByKey.get(k).push(t);
  }
  for (const list of texByKey.values()) {
    list.sort((a, b) => (a.info.letter + a.info.race).localeCompare(b.info.letter + b.info.race));
  }

  const usedTextures = new Set();
  const collections = new Map();
  for (const d of drawables) {
    const i = d.info;
    let matched = i.slot ? texByKey.get(texKey(i)) || [] : [];
    // Packs sometimes mix prefixes; fall back to a match on slot + number alone.
    if (matched.length === 0 && i.slot) {
      matched = textures.filter((t) => t.info.slot === i.slot && t.info.index === i.index && t.info.folder === i.folder);
    }
    matched.forEach((t) => usedTextures.add(t));
    if (!collections.has(i.collection)) collections.set(i.collection, new Map());
    const slots = collections.get(i.collection);
    const s = slotInfo(i.slot);
    if (!slots.has(s.key)) slots.set(s.key, { ...s, items: [] });
    slots.get(s.key).items.push({ id: d.path, name: d.info.name, drawable: d, textures: matched });
  }

  const result = [...collections.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, slots]) => ({
      name,
      slots: [...slots.values()]
        .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key))
        .map((s) => ({ ...s, items: s.items.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })) })),
    }));

  return { collections: result, looseTextures: textures.filter((t) => !usedTextures.has(t)), allTextures: textures };
}

export function textureLabel(info) {
  if (!info.letter) return info.name;
  const race = info.race ? ` · ${RACE_LABELS[info.race] || info.race}` : '';
  return `${info.letter.toUpperCase()}${race}`;
}
