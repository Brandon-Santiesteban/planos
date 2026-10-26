import { useCallback, useState } from 'react';
import { getCurrentHandle, setCurrentHandle } from '../persistence/currentFile';
import { openProject, saveProject } from '../persistence/projectFile';
import { useEditor } from '../store/editorStore';
import { notify } from './toasts';

export function useProjectFile() {
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const h = await saveProject(useEditor.getState().project, getCurrentHandle());
      if (h) setCurrentHandle(h);
      if (h || !('showSaveFilePicker' in window)) {
        useEditor.getState().markSaved();
        notify({ kind: 'ok', text: h ? `Guardado en ${h.name}` : 'Proyecto descargado' });
      }
    } catch (e) {
      notify({ kind: 'error', text: 'No se pudo guardar', detail: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }, []);

  const open = useCallback(async () => {
    try {
      const r = await openProject();
      if (!r) return;
      if ('error' in r) {
        notify({ kind: 'error', text: r.error });
        return;
      }
      useEditor.getState().loadProject(r.project);
      setCurrentHandle(r.handle ?? undefined); // after loadProject, which clears it
      notify({ kind: 'ok', text: `Abierto «${r.project.name}»` });
    } catch (e) {
      notify({ kind: 'error', text: 'No se pudo abrir', detail: (e as Error).message });
    }
  }, []);

  return { save, open, saving };
}
