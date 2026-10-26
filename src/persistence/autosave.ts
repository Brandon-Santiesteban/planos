import { get, set } from 'idb-keyval';
import type { Project } from '../model/types';
import { useEditor } from '../store/editorStore';
import { parseProject, serializeProject } from './projectFile';

const KEY = 'autosave';
const DELAY_MS = 1000;

/** Saves the project to IndexedDB 1 s after the last change. Returns an unsubscribe function. */
export function startAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = useEditor.subscribe((state, prev) => {
    if (state.project === prev.project) return;
    clearTimeout(timer);
    timer = setTimeout(() => void set(KEY, serializeProject(state.project)).catch(() => {}), DELAY_MS);
  });
  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}

export async function loadAutosave(): Promise<Project | null> {
  try {
    const text = await get<string>(KEY);
    if (!text) return null;
    const r = parseProject(text);
    return r.ok ? r.project : null;
  } catch {
    return null;
  }
}
