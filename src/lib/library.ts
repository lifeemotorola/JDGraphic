/**
 * My templates — a user-owned template library.
 *
 * A built-in `Template` is *code*: a `build(net)` function that re-lays its
 * artwork every time the dimensions change. A user template can't be code, so
 * it stores a full `Design` snapshot instead — structure, params, board,
 * panel fills and objects — which is exactly what `loadDesign` consumes.
 *
 * The library lives in `localStorage` (nothing is uploaded, same promise the
 * exporters make) and is portable through a versioned `.boxcraft-library.json`
 * file so a library can move between browsers or be shared with a colleague.
 */
import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { BOX_TYPES, boxTypeById, type BoxTypeId } from './geometry';
import { MATERIALS, newObject, startDesign, type Design, type DesignObject } from './store';

export const LIB_KEY = 'boxcraft.library.v1';
export const LIB_FORMAT = 'boxcraft.library';
export const LIB_VERSION = 1;

export interface UserTemplate {
  id: string;
  name: string;
  category: string;
  blurb: string;
  createdAt: number;
  updatedAt: number;
  /** full snapshot — loaded verbatim into the studio */
  design: Design;
}

export interface LibraryFile {
  format: typeof LIB_FORMAT;
  version: number;
  exported: string;
  templates: UserTemplate[];
}

export interface TemplateMeta {
  name: string;
  category: string;
  blurb: string;
}

export const DEFAULT_CATEGORY = 'My designs';

/** Categories offered in the save dialog — built-in ones plus whatever exists. */
export const SUGGESTED_CATEGORIES = [
  DEFAULT_CATEGORY, 'Beauty', 'Food & Bev', 'Tech', 'E-commerce',
  'Health', 'Kids', 'Home', 'Media', 'Pet', 'Outdoor', 'Premium',
  'Wine & Spirits',
];

const deepClone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/* ------------------------------ validation ------------------------------ */

const num = (v: unknown, fallback: number, min: number, max: number) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);

/**
 * Coerce anything that claims to be a Design into a Design we can safely fold.
 * Imported files and old snapshots are untrusted: a bad `boxType` or a NaN
 * dimension would take the whole net builder down.
 */
export function sanitizeDesign(raw: unknown): Design | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, any>;
  const base = startDesign();

  const boxType: BoxTypeId = BOX_TYPES.some((b) => b.id === r.boxType) ? r.boxType : base.boxType;
  const [dL, dW, dH] = boxTypeById(boxType).defaults;
  const p = (r.params ?? {}) as Record<string, unknown>;

  const objects: DesignObject[] = Array.isArray(r.objects)
    ? r.objects.slice(0, 400).map((o: any) => {
        const type = ['rect', 'ellipse', 'text', 'image', 'line'].includes(o?.type) ? o.type : 'rect';
        return newObject(type, {
          ...o,
          id: str(o?.id) || nanoid(6),
          type,
          x: num(o?.x, 0, -1e4, 1e4),
          y: num(o?.y, 0, -1e4, 1e4),
          w: num(o?.w, 20, 0, 1e4),
          h: num(o?.h, 20, 0, 1e4),
          rot: num(o?.rot, 0, -360, 360),
          opacity: num(o?.opacity, 1, 0, 1),
        });
      })
    : [];

  const fills: Record<string, string> = {};
  if (r.panelFills && typeof r.panelFills === 'object') {
    for (const [k, v] of Object.entries(r.panelFills as Record<string, unknown>)) {
      if (typeof v === 'string') fills[k] = v;
    }
  }

  return {
    ...base,
    name: str(r.name, 'Untitled carton').slice(0, 80) || 'Untitled carton',
    boxType,
    params: {
      L: num(p.L, dL, 5, 2000),
      W: num(p.W, dW, 5, 2000),
      H: num(p.H, dH, 5, 2000),
      caliper: num(p.caliper, 0.45, 0.1, 6),
      glue: num(p.glue, 12, 0, 100),
      bleed: num(p.bleed, 3, 0, 20),
    },
    materialId: MATERIALS.some((m) => m.id === r.materialId) ? r.materialId : base.materialId,
    boardColor: str(r.boardColor, base.boardColor),
    innerColor: str(r.innerColor, base.innerColor),
    panelFills: Object.keys(fills).length ? fills : base.panelFills,
    objects,
    scene: { ...base.scene, ...(typeof r.scene === 'object' && r.scene ? r.scene : {}) },
  };
}

function sanitizeTemplate(raw: unknown): UserTemplate | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, any>;
  const design = sanitizeDesign(r.design);
  if (!design) return null;
  const now = Date.now();
  return {
    id: str(r.id) || nanoid(8),
    name: (str(r.name) || design.name || 'Untitled template').slice(0, 80),
    category: (str(r.category) || DEFAULT_CATEGORY).slice(0, 40),
    blurb: str(r.blurb).slice(0, 240),
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : now,
    design,
  };
}

/* ------------------------------ derived bits ----------------------------- */

export const templateDims = (t: UserTemplate): [number, number, number] => [
  Math.round(t.design.params.L), Math.round(t.design.params.W), Math.round(t.design.params.H),
];

/** Up to four representative colours: panel fills first, then artwork. */
export function templateSwatch(t: UserTemplate): string[] {
  const seen: string[] = [];
  const push = (c?: string) => {
    if (!c || c === 'none' || !/^#[0-9a-f]{3,8}$/i.test(c)) return;
    const k = c.toLowerCase();
    if (!seen.includes(k)) seen.push(k);
  };
  Object.values(t.design.panelFills).forEach(push);
  t.design.objects.forEach((o) => push(o.fill));
  push(t.design.boardColor);
  return seen.slice(0, 4);
}

/** Rough on-disk size of a template, for the storage meter. */
export const templateBytes = (t: UserTemplate) => {
  try { return new Blob([JSON.stringify(t)]).size; } catch { return JSON.stringify(t).length; }
};

export const prettyBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;

export const timeAgo = (ts: number) => {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return new Date(ts).toLocaleDateString();
};

/** A user template becomes a live design by cloning — never hand out the original. */
export const templateDesign = (t: UserTemplate): Design => deepClone(t.design);

export function makeTemplate(design: Design, meta: Partial<TemplateMeta> = {}): UserTemplate {
  const now = Date.now();
  return {
    id: nanoid(8),
    name: (meta.name || design.name || 'Untitled template').slice(0, 80),
    category: (meta.category || DEFAULT_CATEGORY).slice(0, 40),
    blurb: (meta.blurb || '').slice(0, 240),
    createdAt: now,
    updatedAt: now,
    design: deepClone(design),
  };
}

/* ------------------------------ persistence ------------------------------ */

function readStore(): UserTemplate[] {
  try {
    const raw = localStorage.getItem(LIB_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : parsed?.templates;
    if (!Array.isArray(list)) return [];
    return list.map(sanitizeTemplate).filter((t): t is UserTemplate => !!t);
  } catch {
    return [];
  }
}

function writeStore(items: UserTemplate[]): string {
  try {
    localStorage.setItem(LIB_KEY, JSON.stringify({ format: LIB_FORMAT, version: LIB_VERSION, templates: items }));
    return '';
  } catch (e) {
    const quota = e instanceof DOMException && /quota|exceeded/i.test(e.name + e.message);
    return quota
      ? 'Browser storage is full — remove a template (large embedded images are the usual culprit) and try again.'
      : 'Could not write to browser storage. Private-mode windows often block it.';
  }
}

export function libraryFile(items: UserTemplate[]): LibraryFile {
  return { format: LIB_FORMAT, version: LIB_VERSION, exported: new Date().toISOString(), templates: items };
}

/** Accepts a library file, a bare array, or a single `.boxcraft.json` design. */
export function parseLibraryFile(text: string): UserTemplate[] | null {
  let data: unknown;
  try { data = JSON.parse(text); } catch { return null; }
  const list: unknown[] | null = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.templates)
      ? (data as any).templates as unknown[]
      : null;
  if (list) {
    const out = list.map(sanitizeTemplate).filter((t): t is UserTemplate => !!t);
    return out.length ? out : null;
  }
  // a single project file — import it as one template
  const design = sanitizeDesign(data);
  return design ? [makeTemplate(design, { name: design.name, blurb: 'Imported project file.' })] : null;
}

/* -------------------------------- the store ------------------------------- */

export type SaveTarget = { open: false } | { open: true; id?: string };

interface LibraryState {
  items: UserTemplate[];
  error: string;
  /** save/rename dialog target — `id` set means "edit this entry" */
  dialog: SaveTarget;

  openSave: (id?: string) => void;
  closeSave: () => void;

  add: (design: Design, meta: Partial<TemplateMeta>) => UserTemplate | null;
  edit: (id: string, patch: Partial<TemplateMeta>) => void;
  replaceDesign: (id: string, design: Design) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => UserTemplate | null;
  importTemplates: (items: UserTemplate[]) => number;
  clearAll: () => void;
  clearError: () => void;
  /** re-read storage (another tab wrote to it) */
  sync: () => void;
}

export const useLibrary = create<LibraryState>((set, get) => ({
  items: readStore(),
  error: '',
  dialog: { open: false },

  openSave: (id) => set({ dialog: { open: true, id } }),
  closeSave: () => set({ dialog: { open: false } }),
  clearError: () => set({ error: '' }),

  add: (design, meta) => {
    const t = makeTemplate(design, meta);
    const items = [t, ...get().items];
    const error = writeStore(items);
    if (error) { set({ error }); return null; }
    set({ items, error: '' });
    return t;
  },

  edit: (id, patch) => {
    const items = get().items.map((t) => (t.id === id
      ? {
          ...t,
          name: (patch.name ?? t.name).slice(0, 80) || t.name,
          category: (patch.category ?? t.category).slice(0, 40) || DEFAULT_CATEGORY,
          blurb: (patch.blurb ?? t.blurb).slice(0, 240),
          updatedAt: Date.now(),
        }
      : t));
    const error = writeStore(items);
    set(error ? { error } : { items, error: '' });
  },

  replaceDesign: (id, design) => {
    const items = get().items.map((t) => (t.id === id
      ? { ...t, design: deepClone(design), updatedAt: Date.now() }
      : t));
    const error = writeStore(items);
    set(error ? { error } : { items, error: '' });
  },

  remove: (id) => {
    const items = get().items.filter((t) => t.id !== id);
    const error = writeStore(items);
    set(error ? { error } : { items, error: '' });
  },

  duplicate: (id) => {
    const src = get().items.find((t) => t.id === id);
    if (!src) return null;
    const copy: UserTemplate = {
      ...deepClone(src),
      id: nanoid(8),
      name: `${src.name} copy`.slice(0, 80),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const i = get().items.findIndex((t) => t.id === id);
    const items = [...get().items];
    items.splice(i + 1, 0, copy);
    const error = writeStore(items);
    if (error) { set({ error }); return null; }
    set({ items, error: '' });
    return copy;
  },

  importTemplates: (incoming) => {
    const existing = get().items;
    const ids = new Set(existing.map((t) => t.id));
    const fresh = incoming.map((t) => (ids.has(t.id) ? { ...t, id: nanoid(8) } : t));
    const items = [...fresh, ...existing];
    const error = writeStore(items);
    if (error) { set({ error }); return 0; }
    set({ items, error: '' });
    return fresh.length;
  },

  clearAll: () => {
    const error = writeStore([]);
    set(error ? { error } : { items: [], error: '' });
  },

  sync: () => set({ items: readStore() }),
}));

// keep two studio tabs from clobbering each other's library
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LIB_KEY) useLibrary.getState().sync();
  });
}
