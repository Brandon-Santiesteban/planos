import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createEmptyProject } from '../model/defaults';
import { library } from '../persistence/appLibrary';
import type { LibraryEntry } from '../persistence/library';
import { useEditor } from '../store/editorStore';
import { askConfirm } from './Dialog';
import Icon from './Icon';
import { notify } from './toasts';

export const useProjectsDialog = create<{ open: boolean }>()(() => ({ open: false }));
export const openProjectsDialog = () => useProjectsDialog.setState({ open: true });
const close = () => useProjectsDialog.setState({ open: false });

const two = (n: number) => String(n).padStart(2, '0');
function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** "Mis proyectos": every project saved automatically in this browser, plus opening a file from the PC. */
export default function ProjectsDialog({ onOpenFile }: { onOpenFile: () => void }) {
  const open = useProjectsDialog((s) => s.open);
  const currentId = useEditor((s) => s.project.id);
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null);

  const refresh = () => void library.list().then(setEntries).catch(() => setEntries([]));
  useEffect(() => {
    if (open) refresh();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      close();
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  if (!open) return null;

  const openEntry = async (e: LibraryEntry) => {
    const p = await library.load(e.id);
    if (!p) {
      notify({ kind: 'error', text: `No se pudo abrir «${e.name}»` });
      return;
    }
    useEditor.getState().loadProject(p);
    close();
    notify({ kind: 'ok', text: `Abierto «${p.name}»` });
  };

  const removeEntry = async (e: LibraryEntry) => {
    const ok = await askConfirm({
      title: `¿Eliminar «${e.name}»?`,
      text: 'Se borrará de Mis proyectos en este navegador. Los archivos que hayas guardado en tu PC no se tocan.',
      confirmLabel: 'Eliminar proyecto',
      danger: true,
    });
    if (!ok) return;
    await library.remove(e.id);
    refresh();
  };

  const startNew = () => {
    useEditor.getState().loadProject(createEmptyProject());
    close();
  };

  return (
    <div className="velo" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) close(); }}>
      <div className="ventana" role="dialog" aria-modal="true" aria-labelledby="proyectos-title">
        <h2 id="proyectos-title">Mis proyectos</h2>
        <p className="parrafo hint">Todo lo que diseñas se guarda solo en este navegador mientras trabajas. Para tener una copia en tu PC, usa Guardar.</p>
        {entries === null ? (
          <div className="lista-proyectos">{[0, 1, 2].map((i) => <div key={i} className="fila-cargando" />)}</div>
        ) : entries.length === 0 ? (
          <p className="hint">Todavía no hay proyectos guardados.</p>
        ) : (
          <ul className="lista-proyectos">
            {entries.map((e) => {
              const isCurrent = e.id === currentId;
              return (
                <li key={e.id}>
                  <button className="fila-proyecto" onClick={() => !isCurrent && openEntry(e)} disabled={isCurrent}>
                    <span className="inicial">{e.name.slice(0, 1).toUpperCase()}</span>
                    <span className="datos">
                      <span className="nombre">{e.name}</span>
                      <span className="secundario">
                        {formatDate(e.updatedAt)} · {e.floors} {e.floors === 1 ? 'planta' : 'plantas'}
                      </span>
                    </span>
                    {isCurrent && <span className="etiqueta-estado">Abierto</span>}
                  </button>
                  <button className="btn btn-icono" aria-label={`Eliminar ${e.name}`} title="Eliminar" onClick={() => removeEntry(e)} disabled={isCurrent}>
                    <Icon name="trash" size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="ventana-botones">
          <button className="btn btn-sec" onClick={() => { close(); onOpenFile(); }}><Icon name="open" size={16} />Abrir archivo del PC</button>
          <button className="btn btn-sec" onClick={startNew}><Icon name="new" size={16} />Proyecto nuevo</button>
          <button className="btn btn-sec" onClick={close}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
