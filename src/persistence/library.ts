import { del, get, set } from 'idb-keyval';
import type { Project } from '../model/types';
import { parseProject, serializeProject } from './projectFile';

/** Minimal key–value storage (IndexedDB in the app, memory in tests). */
export interface KV {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
}

export const idbKV: KV = { get: (k) => get<string>(k), set: (k, v) => set(k, v), del: (k) => del(k) };

export function memoryKV(): KV {
  const m = new Map<string, string>();
  return {
    get: async (k) => m.get(k),
    set: async (k, v) => void m.set(k, v),
    del: async (k) => void m.delete(k),
  };
}

export type LibraryEntry = { id: string; name: string; updatedAt: number; floors: number };

/** Where a project came from when it was opened from a file served by the app (`ejemplos/…`). */
export type Origin = {
  /** e.g. `ejemplos/nueva-casa.casa.json` */
  file: string;
  /** hash of the file's text the last time it was loaded */
  fileHash: string;
  /** hash of the project exactly as loaded from that file: a different hash means the user changed it */
  projectHash: string;
};

const INDEX = 'proyectos';
const LAST = 'ultimo';
const LEGACY = 'autosave'; // single slot used before the library existed
const projectKey = (id: string) => `proyecto:${id}`;
const originKey = (id: string) => `origen:${id}`;

/** Every project the user works on, saved in the browser on this PC. */
export function createLibrary(kv: KV = idbKV, now: () => number = Date.now) {
  async function readIndex(): Promise<LibraryEntry[]> {
    try {
      return JSON.parse((await kv.get(INDEX)) ?? '[]') as LibraryEntry[];
    } catch {
      return [];
    }
  }

  async function save(p: Project): Promise<void> {
    await kv.set(projectKey(p.id), serializeProject(p));
    const entry: LibraryEntry = { id: p.id, name: p.name, updatedAt: now(), floors: p.floors.length };
    const index = (await readIndex()).filter((e) => e.id !== p.id);
    await kv.set(INDEX, JSON.stringify([entry, ...index]));
    await kv.set(LAST, p.id);
  }

  async function load(id: string): Promise<Project | null> {
    const text = await kv.get(projectKey(id));
    if (!text) return null;
    const r = parseProject(text);
    return r.ok ? r.project : null;
  }

  async function list(): Promise<LibraryEntry[]> {
    return (await readIndex()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async function remove(id: string): Promise<void> {
    await kv.del(projectKey(id));
    await kv.del(originKey(id));
    await kv.set(INDEX, JSON.stringify((await readIndex()).filter((e) => e.id !== id)));
  }

  /** Marks the project the user has open, so it is the one restored next time. */
  async function setLast(id: string): Promise<void> {
    await kv.set(LAST, id);
  }

  async function last(): Promise<Project | null> {
    const id = await kv.get(LAST);
    if (id) {
      const p = await load(id);
      if (p) return p;
      const newest = (await list())[0];
      return newest ? load(newest.id) : null;
    }
    const legacy = await kv.get(LEGACY);
    if (!legacy) return null;
    const r = parseProject(legacy);
    if (!r.ok) return null;
    await save(r.project);
    await kv.del(LEGACY);
    return r.project;
  }

  async function origin(id: string): Promise<Origin | null> {
    try {
      const text = await kv.get(originKey(id));
      return text ? (JSON.parse(text) as Origin) : null;
    } catch {
      return null;
    }
  }

  async function setOrigin(id: string, o: Origin): Promise<void> {
    await kv.set(originKey(id), JSON.stringify(o));
  }

  return { save, load, list, remove, last, setLast, origin, setOrigin };
}

export type Library = ReturnType<typeof createLibrary>;
