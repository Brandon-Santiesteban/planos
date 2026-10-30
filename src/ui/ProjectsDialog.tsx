import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createEmptyProject } from '../model/defaults';
import type { Project } from '../model/types';
import { library } from '../persistence/appLibrary';
import type { LibraryEntry } from '../persistence/library';
import { adoptFile, fetchText, linkFor } from '../persistence/openFromUrl';
import { parseProject } from '../persistence/projectFile';
import { renameProject } from '../persistence/rename';
import { useEditor } from '../store/editorStore';
import { askConfirm } from './Dialog';
import { isEditableTarget } from './keys';
import Icon from './Icon';
import PlanThumbnail from './PlanThumbnail';
import { notify } from './toasts';

export const useProjectsDialog = create<{ open: boolean }>()(() => ({ open: false }));
export const openProjectsDialog = () => useProjectsDialog.setState({ open: true });
const close = () => useProjectsDialog.setState({ open: false });

/** A project file served by the app (public/ejemplos), listed by the dev server in /ejemplos/catalogo.json. */
export type CatalogEntry = { file: string; id: string; name: string; floors: number; updatedAt: number; preview: string | null };

async function loadCatalog(): Promise<CatalogEntry[]> {
  try {
    return JSON.parse(await fetchText('/ejemplos/catalogo.json')) as CatalogEntry[];
  } catch {
    return [];
  }
}

const two = (n: number) => String(n).padStart(2, '0');
function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()} ${two(d.getHours())}:${two(d.getMinutes())}`;
}
const floorsLabel = (n: number) => `${n} ${n === 1 ? 'planta' : 'plantas'}`;

/** The link that always opens the latest version of a project file. */
export const shareLink = (file: string) => `${location.origin}${location.pathname}${linkFor(file)}`;

async function copyLink(file: string) {
  const url = shareLink(file);
  try {
    await navigator.clipboard.writeText(url);
    notify({ kind: 'ok', text: 'Enlace copiado', detail: url });
  } catch {
    prompt('Copia el enlace', url);
  }
}

/** Loads a project only to draw its preview, once the card is on screen. */
function usePreviewProject(load: () => Promise<Project | null>, key: string) {
  const [p, setP] = useState<Project | null>(null);
  useEffect(() => {
    let alive = true;
    load().then((x) => alive && setP(x)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);
  return p;
}

function Preview({ image, load, cacheKey }: { image?: string | null; load: () => Promise<Project | null>; cacheKey: string }) {
  const project = usePreviewProject(load, cacheKey);
  return (
    <span className="ficha-vista">
      {image ? <img src={`/${image}`} alt="" loading="lazy" /> : project ? <PlanThumbnail project={project} /> : <span className="fila-cargando" />}
      {image && project && <span className="ficha-plano"><PlanThumbnail project={project} /></span>}
    </span>
  );
}

/** Inline name field shown in a card: Enter or «Guardar» renames, Escape or «Cancelar» leaves it as it was. */
function RenameForm({ name, onSave, onCancel }: { name: string; onSave: (name: string) => Promise<void>; onCancel: () => void }) {
  const [text, setText] = useState(name);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const next = text.trim();
    if (!next || next === name) return onCancel();
    setBusy(true);
    try {
      await onSave(next);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ficha-renombrar">
      <input
        autoFocus
        aria-label="Nombre del proyecto"
        value={text}
        disabled={busy}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save();
          if (e.key === 'Escape') onCancel();
        }}
      />
      <div className="ficha-acciones">
        <button className="btn btn-chico" onClick={() => void save()} disabled={busy}><Icon name="check" size={16} />Guardar</button>
        <button className="btn btn-chico" onClick={onCancel} disabled={busy}>Cancelar</button>
      </div>
    </div>
  );
}

/** "Mis proyectos": the projects Claude prepared (files in the app) and the ones drawn in this browser, as a gallery. */
export default function ProjectsDialog({ onOpenFile }: { onOpenFile: () => void }) {
  const open = useProjectsDialog((s) => s.open);
  const currentId = useEditor((s) => s.project.id);
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null);
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const refresh = () => {
    void loadCatalog().then(setCatalog);
    void library.list().then(setEntries).catch(() => setEntries([]));
  };
  useEffect(() => {
    if (open) refresh();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || isEditableTarget(e.target)) return;
      close();
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  if (!open) return null;

  const show = async (p: Project, notice?: string) => {
    // Mark it as the last project before showing it, so a reload right away reopens this one.
    await library.setLast(p.id).catch(() => {});
    useEditor.getState().loadProject(p);
    useEditor.getState().setActiveFloor(p.floors[p.floors.length - 1].id);
    close();
    notify({ kind: 'ok', text: `Abierto «${p.name}»` });
    if (notice) notify({ kind: 'info', text: notice });
  };

  const openFile = async (c: CatalogEntry) => {
    const r = await fetchText(`/${c.file}`).then((t) => adoptFile(c.file, t, library)).catch(() => null);
    if (r) await show(r.project, r.notice);
    else notify({ kind: 'error', text: `No se pudo abrir «${c.name}»` });
  };

  const openEntry = async (e: LibraryEntry) => {
    const p = await library.load(e.id);
    if (p) await show(p);
    else notify({ kind: 'error', text: `No se pudo abrir «${e.name}»` });
  };

  const removeEntry = async (e: LibraryEntry) => {
    const ok = await askConfirm({
      title: `¿Eliminar «${e.name}»?`,
      text: 'Se borrará de Mis proyectos. Los archivos que hayas guardado con Guardar no se tocan.',
      confirmLabel: 'Eliminar proyecto',
      danger: true,
    });
    if (!ok) return;
    await library.remove(e.id);
    refresh();
  };

  const rename = async (id: string, oldName: string, name: string, file?: string) => {
    try {
      await renameProject(id, name, file);
      notify({ kind: 'ok', text: `«${oldName}» ahora se llama «${name}»`, detail: 'Solo cambió el nombre: el dibujo y el enlace siguen iguales.' });
      setEditing(null);
      refresh();
    } catch (err) {
      notify({ kind: 'error', text: 'No se pudo cambiar el nombre', detail: (err as Error).message });
    }
  };

  const startNew = () => {
    useEditor.getState().loadProject(createEmptyProject());
    close();
  };

  const fileIds = new Set(catalog?.map((c) => c.id));
  const own = entries?.filter((e) => !fileIds.has(e.id)) ?? null;
  const loadingCards = <>{[0, 1, 2].map((i) => <div key={i} className="ficha ficha-cargando" />)}</>;

  return (
    <div className="velo" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) close(); }}>
      <div className="ventana ventana-biblioteca" role="dialog" aria-modal="true" aria-labelledby="proyectos-title">
        <h2 id="proyectos-title">Mis proyectos</h2>
        <div className="biblioteca-cuerpo">
          <section>
            <h3 className="biblioteca-titulo">Proyectos de la app</h3>
            <p className="hint">Cada uno tiene un enlace fijo: ábrelo cuando quieras y siempre verás la última versión.</p>
            <div className="galeria">
              {catalog === null ? loadingCards : catalog.length === 0 ? <p className="hint">No hay proyectos en la app.</p> : catalog.map((c) => {
                const isCurrent = c.id === currentId;
                return (
                  <article key={c.file} className={`ficha${isCurrent ? ' actual' : ''}`}>
                    <button className="ficha-abrir" onClick={() => openFile(c)} aria-label={`Abrir ${c.name}`}>
                      <Preview image={c.preview} cacheKey={`${c.file}:${c.updatedAt}`} load={async () => {
                        const r = parseProject(await fetchText(`/${c.file}`));
                        return r.ok ? r.project : null;
                      }} />
                      <span className="ficha-datos">
                        <span className="nombre">{c.name}</span>
                        <span className="secundario">{formatDate(c.updatedAt)} · {floorsLabel(c.floors)}</span>
                      </span>
                      {isCurrent && <span className="etiqueta-estado">Abierto</span>}
                    </button>
                    {editing === c.file ? (
                      <RenameForm name={c.name} onCancel={() => setEditing(null)} onSave={(n) => rename(c.id, c.name, n, c.file)} />
                    ) : (
                      <div className="ficha-acciones">
                        <button className="btn btn-chico" onClick={() => copyLink(c.file)} title={shareLink(c.file)}>
                          <Icon name="copy" size={16} />Copiar enlace
                        </button>
                        <button className="btn btn-chico" onClick={() => setEditing(c.file)} title="Cambiar nombre" aria-label={`Cambiar nombre de ${c.name}`}>
                          <Icon name="edit" size={16} />Nombre
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
          <section>
            <h3 className="biblioteca-titulo">Mis dibujos</h3>
            <p className="hint">Se guardan solos en este PC mientras trabajas, así que aparecen con cualquier enlace o computador.</p>
            <div className="galeria">
              {own === null ? loadingCards : own.length === 0 ? <p className="hint">Todavía no hay proyectos propios.</p> : own.map((e) => {
                const isCurrent = e.id === currentId;
                return (
                  <article key={e.id} className={`ficha${isCurrent ? ' actual' : ''}`}>
                    <button className="ficha-abrir" onClick={() => !isCurrent && openEntry(e)} disabled={isCurrent} aria-label={`Abrir ${e.name}`}>
                      <Preview cacheKey={`${e.id}:${e.updatedAt}`} load={() => library.load(e.id)} />
                      <span className="ficha-datos">
                        <span className="nombre">{e.name}</span>
                        <span className="secundario">{formatDate(e.updatedAt)} · {floorsLabel(e.floors)}</span>
                      </span>
                      {isCurrent && <span className="etiqueta-estado">Abierto</span>}
                    </button>
                    {editing === e.id ? (
                      <RenameForm name={e.name} onCancel={() => setEditing(null)} onSave={(n) => rename(e.id, e.name, n)} />
                    ) : (
                      <div className="ficha-acciones">
                        <button className="btn btn-chico" onClick={() => setEditing(e.id)} title="Cambiar nombre" aria-label={`Cambiar nombre de ${e.name}`}>
                          <Icon name="edit" size={16} />Nombre
                        </button>
                        <button className="btn btn-chico" aria-label={`Eliminar ${e.name}`} onClick={() => removeEntry(e)} disabled={isCurrent}>
                          <Icon name="trash" size={16} />Eliminar
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </div>
        <div className="ventana-botones">
          <button className="btn btn-sec" onClick={() => { close(); onOpenFile(); }}><Icon name="open" size={16} />Abrir archivo del PC</button>
          <button className="btn btn-sec" onClick={startNew}><Icon name="new" size={16} />Proyecto nuevo</button>
          <button className="btn btn-sec" onClick={close}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
