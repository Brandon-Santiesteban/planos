import { useEditor } from '../store/editorStore';
import { library } from './appLibrary';
import { pauseLiveCheck, useLinkedOrigin } from './liveLink';
import { hashProject, hashText } from './openFromUrl';
import { parseProject } from './projectFile';

/**
 * Renames a project. Only the name changes: same id, same drawing, same link. If it comes from a file of the app
 * (public/ejemplos), the file is renamed too so every link and computer sees the new name.
 */
export async function renameProject(id: string, name: string, file?: string): Promise<void> {
  const editor = useEditor.getState();
  if (editor.project.id === id) {
    editor.apply((d) => { d.name = name; });
    await library.save(useEditor.getState().project);
  } else {
    const p = await library.load(id);
    if (p) await library.save({ ...p, name });
    else if (!file) throw new Error('No se encontró el proyecto');
  }
  const origin = await library.origin(id);
  const target = origin?.file ?? file;
  if (!target) return;
  pauseLiveCheck();
  const res = await fetch('/api/renombrar', { method: 'POST', body: JSON.stringify({ file: target, name }) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const r = parseProject(text);
  if (!r.ok || !origin) return;
  // The file now has the new name: follow that version, so your own edits still count as yours.
  const next = { ...origin, fileHash: hashText(text), projectHash: hashProject(r.project) };
  await library.setOrigin(id, next);
  if (useEditor.getState().project.id === id) useLinkedOrigin.setState({ origin: next });
}
