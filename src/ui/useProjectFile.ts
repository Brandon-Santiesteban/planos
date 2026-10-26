import { useCallback } from 'react';
import { openProject, saveProject } from '../persistence/projectFile';
import { useEditor } from '../store/editorStore';

// The handle of the file last opened/saved, so "Guardar" overwrites it without asking again.
let currentHandle: FileSystemFileHandle | undefined;

export function useProjectFile() {
  const save = useCallback(async () => {
    try {
      const h = await saveProject(useEditor.getState().project, currentHandle);
      if (h) currentHandle = h;
      if (h || !('showSaveFilePicker' in window)) useEditor.getState().markSaved();
    } catch (e) {
      alert(`No se pudo guardar: ${(e as Error).message}`);
    }
  }, []);

  const open = useCallback(async () => {
    if (useEditor.getState().dirty && !confirm('Hay cambios sin guardar. ¿Abrir otro proyecto?')) return;
    try {
      const r = await openProject();
      if (!r) return;
      if ('error' in r) {
        alert(r.error);
        return;
      }
      currentHandle = r.handle ?? undefined;
      useEditor.getState().loadProject(r.project);
    } catch (e) {
      alert(`No se pudo abrir: ${(e as Error).message}`);
    }
  }, []);

  return { save, open };
}
