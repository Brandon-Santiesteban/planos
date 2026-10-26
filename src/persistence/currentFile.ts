import { useEditor } from '../store/editorStore';

// The file last opened or saved, so "Guardar" overwrites it without asking again.
let currentHandle: FileSystemFileHandle | undefined;

export const getCurrentHandle = () => currentHandle;
export function setCurrentHandle(h: FileSystemFileHandle | undefined): void {
  currentHandle = h;
}

/** Forgets the file whenever another project is loaded (Nuevo, Abrir, restore). Returns an unsubscribe. */
export function trackProjectLoads(): () => void {
  return useEditor.subscribe((s, prev) => {
    if (s.loadCount !== prev.loadCount) currentHandle = undefined;
  });
}
