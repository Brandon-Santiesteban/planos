import { useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import { downloadBlob } from '../../export/exportFile';
import { useEditor } from '../../store/editorStore';
import Icon from '../../ui/Icon';
import SegmentedSwitch from '../../ui/SegmentedSwitch';
import { notify } from '../../ui/toasts';
import { usePlanOptions } from '../planOptions';
import PlanPhotoSvg from './PlanPhotoSvg';
import { DEFAULT_PHOTO_OPTIONS, type PhotoOptions, photoBounds, photoFileName, svgToPng } from './planPhoto';

const ALL = 'todas';

/** Open state, the chosen floor (a floor id or «todas») and what to include (kept while the app is open). */
const usePhoto = create<{ open: boolean; floor: string; opts: PhotoOptions }>()(() => ({
  open: false,
  floor: '',
  opts: { ...DEFAULT_PHOTO_OPTIONS, area: false },
}));

export function openPlanPhoto() {
  const s = usePhoto.getState();
  usePhoto.setState({
    open: true,
    floor: useEditor.getState().activeFloorId,
    // m² starts as the plan shows it the first time; afterwards the window remembers its own choice
    opts: s.floor ? s.opts : { ...s.opts, area: usePlanOptions.getState().showArea },
  });
}
const close = () => usePhoto.setState({ open: false });

const TOGGLES: { key: keyof PhotoOptions; label: string }[] = [
  { key: 'dimensions', label: 'Medidas de los muros' },
  { key: 'names', label: 'Nombres de los espacios' },
  { key: 'area', label: 'Metros cuadrados (m²)' },
  { key: 'furniture', label: 'Muebles' },
  { key: 'site', label: 'Terreno' },
  { key: 'grid', label: 'Cuadrícula' },
  { key: 'below', label: 'Planta de abajo en gris' },
  { key: 'background', label: 'Imagen de fondo (plano calcado)' },
];

interface Shot { floorId: string; name: string; blob: Blob; url: string }

function PlanPhotoDialog() {
  const { floor: choice, opts } = usePhoto();
  const project = useEditor((s) => s.project);
  const sources = useRef(new Map<string, SVGSVGElement>());
  const [shots, setShots] = useState<Shot[]>([]);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  // Floors in the picture(s), each with its framed bounds; empty floors are left out.
  const items = useMemo(() => project.floors
    .map((f, i) => ({ floor: f, index: i, bounds: photoBounds(project, i, opts) }))
    .filter((x) => (choice === ALL || x.floor.id === choice) && x.bounds), [project, choice, opts]);
  const hasBackground = project.floors.some((f) => f.background);

  // Render the PNGs (a moment after the last change) and show them as the preview.
  useEffect(() => {
    let alive = true;
    setBusy(true);
    const t = setTimeout(async () => {
      const out: Shot[] = [];
      try {
        for (const it of items) {
          const svg = sources.current.get(it.floor.id);
          if (!svg) continue;
          const blob = await svgToPng(svg);
          out.push({ floorId: it.floor.id, name: photoFileName(project, it.floor), blob, url: URL.createObjectURL(blob) });
        }
        if (alive) setFailed(null);
      } catch (e) {
        if (alive) setFailed(e instanceof Error ? e.message : String(e));
      }
      if (!alive) {
        out.forEach((s) => URL.revokeObjectURL(s.url));
        return;
      }
      setShots((prev) => {
        prev.forEach((s) => URL.revokeObjectURL(s.url));
        return out;
      });
      setBusy(false);
    }, 120);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [items, project]);
  useEffect(() => () => setShots((prev) => (prev.forEach((s) => URL.revokeObjectURL(s.url)), [])), []);

  const ready = !busy && shots.length > 0;

  const download = () => {
    if (!ready) return;
    for (const s of shots) downloadBlob(s.name, s.blob);
    notify({ kind: 'ok', text: shots.length === 1 ? `Descargada «${shots[0].name}»` : `Descargadas ${shots.length} imágenes` });
  };

  const canCopy = typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;
  const copy = async () => {
    if (!ready || shots.length !== 1) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': shots[0].blob })]);
      notify({ kind: 'ok', text: 'Imagen copiada: pégala en el chat con Ctrl+V' });
    } catch (e) {
      notify({ kind: 'error', text: 'No se pudo copiar la imagen', detail: e instanceof Error ? e.message : String(e) });
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const set = (key: keyof PhotoOptions, v: boolean) => usePhoto.setState({ opts: { ...opts, [key]: v } });
  const floorOptions = [
    ...project.floors.map((f) => ({ value: f.id, label: f.name })),
    ...(project.floors.length > 1 ? [{ value: ALL, label: 'Todas' }] : []),
  ];

  return (
    <div className="velo" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) close(); }}>
      <div className="ventana ventana-foto" role="dialog" aria-modal="true" aria-labelledby="foto-title">
        <h2 id="foto-title">Foto del plano</h2>
        <p className="parrafo">Una imagen limpia del dibujo, sin botones ni menús, para enviarla por chat o correo.</p>
        <div className="foto-cuerpo">
          <div className="foto-opciones">
            <div className="field">
              <span className="label">Planta</span>
              <SegmentedSwitch label="Planta" value={choice} options={floorOptions} onChange={(v) => usePhoto.setState({ floor: v })} />
            </div>
            <div className="field">
              <span className="label">Qué se ve</span>
              {TOGGLES.filter((t) => (t.key !== 'site' || project.site) && (t.key !== 'background' || hasBackground)).map((t) => (
                <label key={t.key} className="foto-casilla">
                  <input type="checkbox" checked={opts[t.key]} onChange={(e) => set(t.key, e.target.checked)} />
                  {t.label}
                </label>
              ))}
            </div>
          </div>
          <div className="foto-vista" aria-busy={busy}>
            {failed ? (
              <p className="parrafo">No se pudo crear la imagen: {failed}</p>
            ) : items.length === 0 ? (
              <p className="parrafo">No hay nada dibujado en esta planta.</p>
            ) : (
              shots.map((s) => <img key={s.floorId} src={s.url} alt={`Vista previa: ${s.name}`} className={busy ? 'actualizando' : undefined} />)
            )}
          </div>
        </div>
        <div className="ventana-botones">
          <button className="btn btn-sec" onClick={close}>Cerrar</button>
          {canCopy && shots.length === 1 && (
            <button className="btn btn-sec" onClick={copy} disabled={!ready}><Icon name="copy" size={16} />Copiar</button>
          )}
          <button className="btn btn-pri" onClick={download} disabled={!ready} autoFocus>
            <Icon name="download" size={16} />{shots.length > 1 ? `Descargar ${shots.length} PNG` : 'Descargar PNG'}
          </button>
        </div>
        {/* The pictures are drawn from these (off screen, always in the light colours). */}
        <div className="foto-plano-fuente" aria-hidden="true">
          {items.map((it) => (
            <PlanPhotoSvg
              key={it.floor.id}
              ref={(el) => { if (el) sources.current.set(it.floor.id, el); else sources.current.delete(it.floor.id); }}
              project={project}
              floorIndex={it.index}
              bounds={it.bounds!}
              opts={opts}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** «Foto del plano» in the plan's bottom-left controls. */
export function PlanPhotoButton() {
  return (
    <button className="btn btn-sec" onClick={openPlanPhoto} title="Descargar una imagen limpia del plano para compartirla">
      <Icon name="camera" size={16} />Foto del plano
    </button>
  );
}

/** The window, rendered at the app's top level (outside the plan controls' styles). */
export default function PlanPhotoHost() {
  const open = usePhoto((s) => s.open);
  return open ? <PlanPhotoDialog /> : null;
}
