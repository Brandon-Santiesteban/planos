import type { Project } from '../model/types';
import type { Library } from './library';
import { parseProject } from './projectFile';

/**
 * Handles `?abrir=ejemplos/archivo.casa.json`: loads a project file served by the app itself.
 * If that project was opened before, the saved copy (with the user's changes) wins.
 */
export async function projectFromUrl(
  search: string,
  fetchText: (path: string) => Promise<string>,
  lib: Library,
): Promise<{ project: Project } | { error: string } | null> {
  const path = new URLSearchParams(search).get('abrir');
  if (!path) return null;
  const error = { error: `No se pudo abrir «${path}»` };
  // Only files served by this app: a relative path without a scheme or "..".
  if (/^[a-z]+:|^\/\/|\.\./i.test(path)) return error;
  try {
    const r = parseProject(await fetchText(`/${path.replace(/^\/+/, '')}`));
    if (!r.ok) return error;
    const saved = await lib.load(r.project.id);
    return { project: saved ?? r.project };
  } catch {
    return error;
  }
}

export async function fetchText(path: string): Promise<string> {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}
