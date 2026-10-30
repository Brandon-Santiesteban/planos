import { newId } from '../model/ids';
import type { Project } from '../model/types';
import type { Library } from './library';
import { parseProject, serializeProject } from './projectFile';

/** Short, stable hash (FNV-1a) used to tell whether a file or a project changed. */
export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export const hashProject = (p: Project) => hashText(serializeProject(p));

/**
 * The file a link points to: `?p=nueva-casa` (short form for `ejemplos/nueva-casa.casa.json`) or
 * `?abrir=ejemplos/archivo.casa.json`. Only files served by this app: no scheme, no "..".
 */
export function linkedFile(search: string): string | null {
  const q = new URLSearchParams(search);
  const short = q.get('p');
  const path = short ? `ejemplos/${short}.casa.json` : q.get('abrir');
  if (!path) return null;
  return path.replace(/^\/+/, '');
}

const isSafe = (path: string) => !/^[a-z]+:|^\/\/|\.\./i.test(path);

/** The short link for a file: `?p=nueva-casa` for `ejemplos/nueva-casa.casa.json`, `?abrir=…` otherwise. */
export function linkFor(file: string): string {
  const m = /^ejemplos\/([\w.-]+)\.casa\.json$/.exec(file);
  return m ? `?p=${encodeURIComponent(m[1])}` : `?abrir=${encodeURIComponent(file)}`;
}

/**
 * Takes the text of a project file served by the app and decides what to open:
 * - the file did not change since it was last opened → the saved copy, with the user's own edits;
 * - the file changed (Claude updated it) → the new file. If the user had edited the old one, their version is kept
 *   in Mis proyectos as «… (mis cambios)» so nothing is lost.
 */
export async function adoptFile(
  file: string,
  text: string,
  lib: Library,
): Promise<{ project: Project; notice?: string } | null> {
  const r = parseProject(text);
  if (!r.ok) return null;
  const fresh = r.project;
  const fileHash = hashText(text);
  const [saved, origin] = await Promise.all([lib.load(fresh.id), lib.origin(fresh.id)]);
  if (saved && origin?.fileHash === fileHash) return { project: saved };

  let notice: string | undefined;
  if (saved && hashProject(saved) !== (origin?.projectHash ?? hashProject(fresh))) {
    const copy: Project = { ...structuredClone(saved), id: newId(), name: `${saved.name} (mis cambios)` };
    await lib.save(copy);
    notice = `Tus cambios quedaron guardados en «${copy.name}»`;
  }
  await lib.save(fresh);
  await lib.setOrigin(fresh.id, { file, fileHash, projectHash: hashProject(fresh) });
  return { project: fresh, notice };
}

/** Handles a link to a project file served by the app (see `linkedFile`). */
export async function projectFromUrl(
  search: string,
  fetchText: (path: string) => Promise<string>,
  lib: Library,
): Promise<{ project: Project; file: string; notice?: string } | { error: string } | null> {
  const file = linkedFile(search);
  if (!file) return null;
  const error = { error: `No se pudo abrir «${file}»` };
  if (!isSafe(file)) return error;
  try {
    const r = await adoptFile(file, await fetchText(`/${file}`), lib);
    return r ? { ...r, file } : error;
  } catch {
    return error;
  }
}

export async function fetchText(path: string): Promise<string> {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}
