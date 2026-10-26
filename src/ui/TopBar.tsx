import { createEmptyProject } from '../model/defaults';
import { useEditor } from '../store/editorStore';
import { useProjectFile } from './useProjectFile';

export default function TopBar() {
  const name = useEditor((s) => s.project.name);
  const dirty = useEditor((s) => s.dirty);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const snapping = useEditor((s) => s.snapping);
  const { save, open } = useProjectFile();

  const onNew = () => {
    if (dirty && !confirm('Hay cambios sin guardar. ¿Empezar un proyecto nuevo?')) return;
    useEditor.getState().loadProject(createEmptyProject());
  };
  const rename = () => {
    const next = prompt('Nombre del proyecto', name)?.trim();
    if (next) useEditor.getState().apply((d) => { d.name = next; });
  };

  return (
    <header className="topbar">
      <strong className="brand">Diseñador de casa</strong>
      <button onClick={onNew}>Nuevo</button>
      <button onClick={open} title="Ctrl+O">Abrir</button>
      <button onClick={save} title="Ctrl+S">Guardar</button>
      <span className="sep" />
      <button onClick={() => useEditor.getState().undo()} disabled={!canUndo} title="Ctrl+Z">Deshacer</button>
      <button onClick={() => useEditor.getState().redo()} disabled={!canRedo} title="Ctrl+Y">Rehacer</button>
      <span className="sep" />
      <label className="toggle">
        <input type="checkbox" checked={snapping} onChange={(e) => useEditor.getState().setSnapping(e.target.checked)} />
        Ajustar a rejilla
      </label>
      <button className="project-name" onClick={rename} title="Cambiar nombre">
        {name}{dirty ? ' •' : ''}
      </button>
    </header>
  );
}
