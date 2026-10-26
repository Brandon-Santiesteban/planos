import { create } from 'zustand';
import type { Project } from '../model/types';
import { useEditor } from '../store/editorStore';
import type { Library } from './library';

const DELAY_MS = 1000;

export interface SaveStatus {
  state: 'idle' | 'saving' | 'saved' | 'error';
  at: number | null;
  /** Name of the linked file also written on every autosave, if any. */
  file: string | null;
}

export const useSaveStatus = create<SaveStatus>()(() => ({ state: 'idle', at: null, file: null }));

/**
 * Saves every change to the projects library 1 s after the last edit, and to the linked file if there is one.
 * `writeFile` returns the file name it wrote, or null when no file is linked.
 */
export function startAutosave({ lib, writeFile }: { lib: Library; writeFile?: (p: Project) => Promise<string | null> }): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Project | null = null;

  async function persist(p: Project) {
    useSaveStatus.setState({ state: 'saving' });
    try {
      await lib.save(p);
      const file = writeFile ? await writeFile(p) : null;
      // Only clear "unsaved" if the editor still shows exactly what was written to the file.
      if (file && useEditor.getState().project === p) useEditor.getState().markSaved();
      useSaveStatus.setState({ state: 'saved', at: Date.now(), file });
    } catch {
      useSaveStatus.setState({ state: 'error' });
    }
  }

  function flush(): Promise<void> {
    clearTimeout(timer);
    const p = pending;
    pending = null;
    return p ? persist(p) : Promise.resolve();
  }

  const unsubscribe = useEditor.subscribe((state, prev) => {
    if (state.loadCount !== prev.loadCount) {
      // Another project was loaded: save what was pending of the previous one right away.
      // ...and only then mark the newly loaded one as last, so the old save can't overwrite that.
      const id = state.project.id;
      void flush().then(() => lib.setLast(id)).catch(() => {});
      useSaveStatus.setState({ state: 'idle', at: null, file: null });
      return;
    }
    if (state.project === prev.project) return;
    pending = state.project;
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), DELAY_MS);
  });

  return () => {
    void flush();
    unsubscribe();
  };
}
