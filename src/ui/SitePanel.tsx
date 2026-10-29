import { useState } from 'react';
import { drawingBounds, setSite, SITE_PRESETS, siteAround, siteFittingDrawing, siteOverflow, type SiteAlign } from '../model/site';
import type { Site } from '../model/types';
import { formatMetres } from '../model/units';
import { useEditor } from '../store/editorStore';
import Dropdown from './Dropdown';
import { LengthField } from './fields';
import Icon from './Icon';
import SegmentedSwitch from './SegmentedSwitch';

const apply = (site: Site | null) => useEditor.getState().apply((d) => setSite(d, site));
const m = (v: number) => formatMetres(v);

/** Which side the drawing sits against in the lot it already has. */
function alignOf(p: Parameters<typeof drawingBounds>[0]): SiteAlign {
  const b = drawingBounds(p);
  if (!b || !p.site) return 'izquierda';
  if (Math.abs(p.site.x - b.minX) < 0.01) return 'izquierda';
  return Math.abs(p.site.x + p.site.width - b.maxX) < 0.01 ? 'derecha' : 'centro';
}

/** The lot the house is drawn on: pick a size and see whether the drawing fits in it. */
export default function SitePanel() {
  const project = useEditor((s) => s.project);
  const site = project.site;
  const [align, setAlign] = useState<SiteAlign>(() => alignOf(project));
  const preset = site ? SITE_PRESETS.find((s) => s.width === site.width && s.depth === site.depth) : undefined;
  const over = siteOverflow(project);
  const sticking = over ? Object.entries(over).filter(([, v]) => v > 0) : [];

  const choose = (width: number, depth: number, a = align) => apply(siteAround(useEditor.getState().project, width, depth, a));

  return (
    <div className="terreno">
      <h3>Terreno</h3>
      <div className="field">
        <span className="label">Medidas del lote</span>
        <Dropdown<string>
          label="Medidas del lote"
          value={preset ? preset.label : site ? 'otro' : 'ninguno'}
          options={[
            { value: 'ninguno', label: 'Sin terreno' },
            ...SITE_PRESETS.map((s) => ({ value: s.label, label: s.label })),
            ...(site && !preset ? [{ value: 'otro', label: `${m(site.width)} × ${m(site.depth)}` }] : []),
          ]}
          onChange={(v) => {
            if (v === 'ninguno') return apply(null);
            const s = SITE_PRESETS.find((x) => x.label === v);
            if (s) choose(s.width, s.depth);
          }}
        />
      </div>
      {site && (
        <>
          <LengthField label="Frente (ancho)" value={site.width} onCommit={(v) => v && v > 0 && choose(v, site.depth)} />
          <LengthField label="Fondo" value={site.depth} onCommit={(v) => v && v > 0 && choose(site.width, v)} />
          <div className="field">
            <span className="label">La casa va pegada a</span>
            <SegmentedSwitch<SiteAlign>
              label="La casa va pegada a"
              value={align}
              options={[{ value: 'izquierda', label: 'Izquierda' }, { value: 'centro', label: 'Centro' }, { value: 'derecha', label: 'Derecha' }]}
              onChange={(a) => { setAlign(a); choose(site.width, site.depth, a); }}
            />
          </div>
          {sticking.length
            ? <p className="hint parrafo aviso">El dibujo se sale del terreno: {sticking.map(([k, v]) => `${m(v)} por ${k === 'fondo' || k === 'frente' ? 'el' : 'la'} ${k}`).join(', ')}.</p>
            : <p className="hint parrafo">El dibujo cabe en el terreno ({(site.width * site.depth).toLocaleString('es', { maximumFractionDigits: 1 })} m²). El frente es el lado de abajo del plano, hacia la calle.</p>}
        </>
      )}
      <div className="acciones">
        <button
          className="btn btn-sec"
          onClick={() => { const s = siteFittingDrawing(useEditor.getState().project); if (s) apply(s); }}
          title="Un lote justo del tamaño de lo dibujado"
        >
          <Icon name="rotate" size={16} />Ajustar al dibujo
        </button>
      </div>
    </div>
  );
}
