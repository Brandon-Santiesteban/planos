import { useCallback } from 'react';
import { getCurrentHandle, setCurrentHandle } from '../persistence/currentFile';
import { openProject, saveProject } from '../persistence/projectFile';
import { useEditor } from '../store/editorStore';

export function useProjectFile() {
  const save = useCallback(async () => {
    try {
      const h = await saveProject(useEditor.getState().project, getCurrentHandle());
      if (h) setCurrentHandle(h);
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
      useEditor.getState().loadProject(r.project);
      setCurrentHandle(r.handle ?? undefined); // after loadProject, which clears it
    } catch (e) {
      alert(`No se pudo abrir: ${(e as Error).message}`);
    }
  }, []);

  return { save, open };
}
