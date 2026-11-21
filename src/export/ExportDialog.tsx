import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { useEditor } from '../store/editorStore';
import Icon from '../ui/Icon';
import SegmentedSwitch from '../ui/SegmentedSwitch';
import { notify } from '../ui/toasts';
import type { DxfUnits } from './dxf';
import { buildExport, downloadBlob, floorsToExport, PDF_DEFAULTS, type ExportFormat, type ExportScope, type PdfChoices } from './exportFile';

/** Open state plus the last choices (kept while the app is open). */
const useExport = create<{ open: boolean; scope: ExportScope; format: ExportFormat; pdf: PdfChoices; units: DxfUnits }>()(() => ({
  open: false,
  scope: 'actual',
  format: 'pdf',
  pdf: PDF_DEFAULTS,
  units: 'mm',
}));
const setPdf = (patch: Partial<PdfChoices>) => useExport.setState((s) => ({ pdf: { ...s.pdf, ...patch } }));
const close = () => useExport.setState({ open: false });

const HELP: Record<ExportFormat, string> = {
  pdf: 'Planos para el arquitecto: textos y cotas a tamaño de imprenta, cotas exteriores encadenadas, cuadro de áreas, norte, escala gráfica y cajetín. Si la planta no cabe en la hoja a esa escala, se reparte en varias hojas con un plano guía, sin reducirla.',
  texto: 'Un texto con cada espacio y sus medidas, qué puerta conecta con qué, los muebles y los muros. Cópialo y pégalo en el chat con Claude, o descárgalo como .txt.',
  dxf: 'Un DXF de AutoCAD 2007 (abre en BricsCAD, DraftSight, LibreCAD…) a escala real, con capas MUROS, HUECOS, ESPACIOS, ESCALERAS, TERRENO, MUEBLES, COTAS y TEXTOS. Con todas las plantas, van una al lado de otra.',
};

function ExportDialog() {
  const { scope, format, pdf, units } = useExport();
  const project = useEditor((s) => s.project);
  const activeFloorId = useEditor((s) => s.activeFloorId);
  const [busy, setBusy] = useState(false);
  const empty = floorsToExport(project, activeFloorId, scope).length === 0;

  const run = async () => {
    if (busy || empty) return;
    setBusy(true);
    try {
      const { name, blob } = await buildExport(project, activeFloorId, scope, format, pdf, { dxfUnits: units });
      downloadBlob(name, blob);
      close();
      notify({ kind: 'ok', text: `Descargado «${name}»` });
    } catch (e) {
      notify({ kind: 'error', text: 'No se pudo exportar el plano', detail: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (busy || empty) return;
    try {
      const { exportText } = await import('./texto');
      await navigator.clipboard.writeText(exportText(project, floorsToExport(project, activeFloorId, scope)));
      close();
      notify({ kind: 'ok', text: 'Texto copiado: pégalo en el chat con Ctrl+V' });
    } catch (e) {
      notify({ kind: 'error', text: 'No se pudo copiar el texto', detail: e instanceof Error ? e.message : String(e) });
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
            options={[{ value: 'pdf', label: 'PDF a escala' }, { value: 'dxf', label: 'DXF para arquitecto' }, { value: 'texto', label: 'Texto para Claude' }]}
            onChange={(v) => useExport.setState({ format: v })}
          />
          <span className="ayuda">{HELP[format]}</span>
        </div>
        {format === 'dxf' && (
          <div className="field">
            <span className="label">Unidades</span>
            <SegmentedSwitch
              label="Unidades"
              value={units}
              options={[{ value: 'mm', label: 'Milímetros' }, { value: 'm', label: 'Metros' }]}
              onChange={(v) => useExport.setState({ units: v })}
            />
            <span className="ayuda">
              {units === 'mm' ? '1 unidad = 1 mm: un muro de 15 cm mide 150.' : '1 unidad = 1 m: un muro de 15 cm mide 0,15.'} Elige las que use la oficina que lo va a abrir.
            </span>
          </div>
        )}
        {format === 'pdf' && (
          <>
            <div className="field">
              <span className="label">Papel</span>
              <SegmentedSwitch
                label="Papel"
                value={pdf.paper}
                options={[{ value: 'A1', label: 'A1' }, { value: 'A2', label: 'A2' }, { value: 'A3', label: 'A3' }]}
                onChange={(v) => setPdf({ paper: v })}
              />
            </div>
            <div className="field">
              <span className="label">Escala</span>
              <SegmentedSwitch
                label="Escala"
                value={String(pdf.scale)}
                options={[
                  { value: 'auto', label: 'Automática' },
                  { value: '50', label: '1:50' },
                  { value: '75', label: '1:75' },
                  { value: '100', label: '1:100' },
                  { value: '200', label: '1:200' },
                ]}
                onChange={(v) => setPdf({ scale: v === 'auto' ? 'auto' : (Number(v) as PdfChoices['scale']) })}
              />
              {pdf.scale === 'auto' && <span className="ayuda">1:50 si la planta cabe en una hoja; si no, 1:100.</span>}
            </div>
            <div className="exportar-opciones">
              <label className="toggle-linea">
                <input type="checkbox" checked={pdf.dimensions} onChange={(e) => setPdf({ dimensions: e.target.checked })} />
                Incluir cotas
              </label>
              <label className="toggle-linea">
                <input type="checkbox" checked={pdf.wallDimensions} onChange={(e) => setPdf({ wallDimensions: e.target.checked })} />
                Cota de cada muro
              </label>
              <label className="toggle-linea">
                <input type="checkbox" checked={pdf.furniture} onChange={(e) => setPdf({ furniture: e.target.checked })} />
                Incluir muebles
              </label>
            </div>
          </>
        )}
        <div className="ventana-botones">
          <button className="btn btn-sec" onClick={close}>Cancelar</button>
          {format === 'texto' && !empty && (
            <button className="btn btn-sec" onClick={copy}><Icon name="copy" size={16} />Copiar texto</button>
          )}
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
      <button className="btn btn-sec" onClick={() => useExport.setState({ open: true })} title="Plano en PDF a escala, DXF o texto para Claude">
        <Icon name="download" size={16} />Exportar
      </button>
      {open && <ExportDialog />}
    </>
  );
}
