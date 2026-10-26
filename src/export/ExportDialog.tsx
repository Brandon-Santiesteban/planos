import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { useEditor } from '../store/editorStore';
import Icon from '../ui/Icon';
import SegmentedSwitch from '../ui/SegmentedSwitch';
import { notify } from '../ui/toasts';
import { buildExport, downloadBlob, floorsToExport, type ExportFormat, type ExportScope } from './exportFile';

/** Open state plus the last choices (kept while the app is open). */
const useExport = create<{ open: boolean; scope: ExportScope; format: ExportFormat }>()(() => ({
  open: false,
  scope: 'actual',
  format: 'pdf',
}));
const close = () => useExport.setState({ open: false });

const HELP: Record<ExportFormat, string> = {
  pdf: 'Una hoja A3 por planta a escala 1:50 (1:100 o 1:200 si no cabe), con cotas, norte, escala gráfica y cajetín.',
  dxf: 'Un archivo en metros para AutoCAD u otro CAD, con capas MUROS, HUECOS, HABITACIONES, MUEBLES, COTAS y TEXTOS. Con todas las plantas, van una al lado de otra.',
};

function ExportDialog() {
  const { scope, format } = useExport();
  const project = useEditor((s) => s.project);
  const activeFloorId = useEditor((s) => s.activeFloorId);
  const [busy, setBusy] = useState(false);
  const empty = floorsToExport(project, activeFloorId, scope).length === 0;

  const run = async () => {
    if (busy || empty) return;
    setBusy(true);
    try {
      const { name, blob } = await buildExport(project, activeFloorId, scope, format);
      downloadBlob(name, blob);
      close();
      notify({ kind: 'ok', text: `Descargado «${name}»` });
    } catch (e) {
      notify({ kind: 'error', text: 'No se pudo exportar el plano', detail: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'Enter') void run();
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  return (
    <div className="velo" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) close(); }}>
      <div className="ventana ventana-exportar" role="dialog" aria-modal="true" aria-labelledby="exportar-title">
        <h2 id="exportar-title">Exportar planos</h2>
        <div className="field">
          <span className="label">Planta</span>
          <SegmentedSwitch
            label="Planta"
            value={scope}
            options={[{ value: 'actual', label: 'Planta actual' }, { value: 'todas', label: 'Todas las plantas' }]}
            onChange={(v) => useExport.setState({ scope: v })}
          />
        </div>
        <div className="field">
          <span className="label">Formato</span>
          <SegmentedSwitch
            label="Formato"
            value={format}
            options={[{ value: 'pdf', label: 'PDF a escala' }, { value: 'dxf', label: 'DXF para arquitecto' }]}
            onChange={(v) => useExport.setState({ format: v })}
          />
          <span className="ayuda">{HELP[format]}</span>
        </div>
        <div className="ventana-botones">
          <button className="btn btn-sec" onClick={close}>Cancelar</button>
          <button className="btn btn-pri" onClick={run} disabled={busy || empty} autoFocus>
            <Icon name={busy ? 'redo' : 'download'} size={16} className={busy ? 'girando' : undefined} />
            {empty ? `Nada que exportar: ${scope === 'actual' ? 'la planta está vacía' : 'no hay nada dibujado'}` :busy ? 'Descargando…' : 'Descargar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** «Exportar» in the top bar, with its window. */
export default function ExportButton() {
  const open = useExport((s) => s.open);
  return (
    <>
      <button className="btn btn-sec" onClick={() => useExport.setState({ open: true })} title="Plano en PDF a escala o DXF">
        <Icon name="download" size={16} />Exportar
      </button>
      {open && <ExportDialog />}
    </>
  );
}
