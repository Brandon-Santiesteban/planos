import { createEmptyProject } from '../model/defaults';
import { useEditor } from '../store/editorStore';
import { askConfirm } from './Dialog';
import Icon from './Icon';
import { useTheme } from './theme';
import { useProjectFile } from './useProjectFile';

export default function TopBar() {
  const name = useEditor((s) => s.project.name);
  const dirty = useEditor((s) => s.dirty);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const snapping = useEditor((s) => s.snapping);
  const theme = useTheme((s) => s.theme);
  const { save, open, saving } = useProjectFile();

  const onNew = async () => {
    if (
      useEditor.getState().dirty &&
      !(await askConfirm({
        title: '¿Empezar un proyecto nuevo?',
        text: 'Hay cambios que no has guardado en un archivo. Si empiezas uno nuevo, este proyecto solo quedará en el guardado automático.',
        confirmLabel: 'Empezar nuevo',
      }))
    ) return;
    useEditor.getState().loadProject(createEmptyProject());
  };

  const rename = () => {
    const next = prompt('Nombre del proyecto', name)?.trim();
    if (next) useEditor.getState().apply((d) => { d.name = next; });
  };

  return (
    <header className="topbar">
      <span className="marca"><Icon name="layers" size={20} />Diseñador de casa</span>
      <button className="btn btn-sec" onClick={onNew}><Icon name="new" size={16} />Nuevo</button>
      <button className="btn btn-sec" onClick={open} title="Ctrl+O"><Icon name="open" size={16} />Abrir</button>
      <span className="sep" />
      <button
        className="btn-icono btn"
        onClick={() => useEditor.getState().undo()}
        disabled={!canUndo}
        title={canUndo ? 'Deshacer (Ctrl+Z)' : 'Nada que deshacer'}
        aria-label="Deshacer"
      >
        <Icon name="undo" size={18} />
      </button>
      <button
        className="btn-icono btn"
        onClick={() => useEditor.getState().redo()}
        disabled={!canRedo}
        title={canRedo ? 'Rehacer (Ctrl+Y)' : 'Nada que rehacer'}
        aria-label="Rehacer"
      >
        <Icon name="redo" size={18} />
      </button>
      <span className="sep" />
      <button
        className={`btn btn-sec${snapping ? ' activo' : ''}`}
        onClick={() => useEditor.getState().setSnapping(!snapping)}
        title="Pegar los puntos a la cuadrícula y a las esquinas (Alt lo desactiva al momento)"
        aria-pressed={snapping}
      >
        <Icon name="magnet" size={16} />Ajustar a cuadrícula
      </button>
      <div className="derecha">
        <button className="btn btn-icono project-name" style={{ width: 'auto', padding: '0 8px', color: 'var(--tinta)' }} onClick={rename} title="Cambiar nombre">
          {name}
        </button>
        <button
          className="btn btn-icono"
          onClick={() => useTheme.getState().setTheme(theme === 'oscuro' ? 'claro' : 'oscuro')}
          title={theme === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          aria-label="Cambiar modo"
        >
          <Icon name={theme === 'oscuro' ? 'sun' : 'moon'} size={18} />
        </button>
        <button className="btn btn-pri" onClick={save} disabled={saving} title="Ctrl+S">
          <Icon name={saving ? 'redo' : 'save'} size={16} className={saving ? 'girando' : undefined} />
          {saving ? 'Guardando…' : dirty ? 'Guardar' : 'Guardado'}
        </button>
      </div>
    </header>
  );
}
