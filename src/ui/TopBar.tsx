import { createEmptyProject } from '../model/defaults';
import { useEditor } from '../store/editorStore';
import { useSaveStatus } from '../persistence/autosave';
import { openProjectsDialog } from './ProjectsDialog';
import { notify } from './toasts';
import Icon from './Icon';
import { useTheme } from './theme';
import { useProjectFile } from './useProjectFile';

export default function TopBar() {
  const name = useEditor((s) => s.project.name);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const snapping = useEditor((s) => s.snapping);
  const theme = useTheme((s) => s.theme);
  const { save, saving } = useProjectFile();
  const status = useSaveStatus();

  // Nothing is lost: the current project stays in Mis proyectos (autosave).
  const onNew = () => {
    const previous = useEditor.getState().project.name;
    useEditor.getState().loadProject(createEmptyProject());
    notify({ kind: 'ok', text: `«${previous}» quedó guardado en Mis proyectos`, action: { label: 'Ver', run: openProjectsDialog } });
  };

  const rename = () => {
    const next = prompt('Nombre del proyecto', name)?.trim();
    if (next) useEditor.getState().apply((d) => { d.name = next; });
  };

  return (
    <header className="topbar">
      <span className="marca"><Icon name="layers" size={20} />Diseñador de casa</span>
      <button className="btn btn-sec" onClick={onNew}><Icon name="new" size={16} />Nuevo</button>
      <button className="btn btn-sec" onClick={openProjectsDialog} title="Mis proyectos (Ctrl+O)"><Icon name="open" size={16} />Mis proyectos</button>
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
        <SaveStatusChip status={status} />
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
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </header>
  );
}

const hhmm = (ms: number) => new Date(ms).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

function SaveStatusChip({ status }: { status: ReturnType<typeof useSaveStatus.getState> }) {
  if (status.state === 'saving') return <span className="estado-guardado" data-testid="estado-guardado">Guardando…</span>;
  if (status.state === 'error') {
    return <span className="estado-guardado error" data-testid="estado-guardado"><Icon name="alert" size={14} />No se pudo guardar</span>;
  }
  if (status.state === 'saved' && status.at) {
    return (
      <span className="estado-guardado" data-testid="estado-guardado" title={status.file ? `También en ${status.file}` : 'En Mis proyectos de este navegador'}>
        <Icon name="check" size={14} />Guardado {hhmm(status.at)}{status.file ? ` · ${status.file}` : ''}
      </span>
    );
  }
  return null;
}
