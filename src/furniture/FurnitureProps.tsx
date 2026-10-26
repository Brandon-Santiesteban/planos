import { useEffect, useId, useState } from 'react';
import { updateFurniture, type FurniturePatch } from '../model/furnitureOps';
import type { Floor } from '../model/types';
import { formatMetres, parseLength } from '../model/units';
import { useEditor } from '../store/editorStore';
import { LengthField } from '../ui/fields';
import Icon from '../ui/Icon';
import { duplicateSelectedFurniture, removeSelectedFurniture } from './actions';
import { catalogItem } from './catalog';
import { Thumb } from './CatalogPanel';

/** Warm, neutral finishes offered as swatches (any #rrggbb can be typed). */
export const SWATCHES = ['#eeebe5', '#d9cfc0', '#b08a63', '#7a5a3f', '#8d939b', '#3b3f45', '#5d6d7e', '#6f7f5c', '#a0522d', '#1d1f22'];

function set(id: string, patch: FurniturePatch) {
  const { apply, activeFloorId } = useEditor.getState();
  apply((d) => void updateFurniture(d, activeFloorId, id, patch));
}

/** Filled field for a number that may be 0 (elevation, degrees). Commits on Enter or blur. */
function ZeroField({ label, value, unit, parse, format, error, help, onCommit }: {
  label: string;
  value: number;
  unit: string;
  parse: (t: string) => number | null;
  format: (v: number) => string;
  error: string;
  help?: string;
  onCommit: (v: number) => void;
}) {
  const id = useId();
  const shown = format(value);
  const [text, setText] = useState(shown);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setText(shown);
    setInvalid(false);
  }, [shown]);
  const commit = () => {
    if (text === shown) return setInvalid(false);
    const v = parse(text);
    if (v === null) return setInvalid(true);
    setInvalid(false);
    onCommit(v);
    setText(shown);
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="with-unit">
        <input
          id={id}
          className={invalid ? 'invalid' : ''}
          value={text}
          inputMode="decimal"
          aria-invalid={invalid}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
        />
        <span className="unit">{unit}</span>
      </div>
      {invalid ? <span className="error">{error}</span> : help && <span className="ayuda">{help}</span>}
    </div>
  );
}

const parseElevation = (t: string) => (/^\s*0*([.,]0*)?\s*(m|cm)?\s*$/i.test(t) && /0/.test(t) ? 0 : parseLength(t));
const parseDegrees = (t: string) => {
  const v = Number(t.trim().replace(',', '.').replace('°', ''));
  return t.trim() !== '' && Number.isFinite(v) ? v : null;
};

function ColorField({ value, onCommit }: { value: string; onCommit: (c: string) => void }) {
  const id = useId();
  const [text, setText] = useState(value);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setText(value);
    setInvalid(false);
  }, [value]);
  const commit = () => {
    const t = text.trim().startsWith('#') ? text.trim() : `#${text.trim()}`;
    if (t.toLowerCase() === value.toLowerCase()) return setInvalid(false);
    if (!/^#[0-9a-f]{6}$/i.test(t)) return setInvalid(true);
    setInvalid(false);
    onCommit(t.toLowerCase());
  };
  return (
    <div className="field">
      <label htmlFor={id}>Color</label>
      <div className="muestras" role="group" aria-label="Colores">
        {SWATCHES.map((c) => (
          <button
            key={c}
            className={`muestra${c === value.toLowerCase() ? ' activa' : ''}`}
            style={{ background: c }}
            title={c}
            aria-label={`Color ${c}`}
            aria-pressed={c === value.toLowerCase()}
            onClick={() => onCommit(c)}
          />
        ))}
      </div>
      <input
        id={id}
        className={invalid ? 'invalid' : ''}
        value={text}
        aria-invalid={invalid}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
      />
      {invalid && <span className="error">Escribe un color como #b08a63.</span>}
    </div>
  );
}

export default function FurnitureProps({ floor, id }: { floor: Floor; id: string }) {
  const f = floor.furniture.find((x) => x.id === id);
  if (!f) return null;
  const item = catalogItem(f.type);
  const color = f.color ?? item?.color ?? '#b08a63';
  return (
    <>
      <div className="mueble-encabezado">
        {item && <Thumb item={item} size={40} />}
        <div>
          <h2>{item?.name ?? f.type}</h2>
          {item && <span className="hint">{item.category}</span>}
        </div>
      </div>
      <LengthField label="Ancho" value={f.width} onCommit={(v) => set(id, { width: v! })} />
      <LengthField label="Fondo" value={f.depth} onCommit={(v) => set(id, { depth: v! })} />
      <LengthField label="Alto" value={f.height} onCommit={(v) => set(id, { height: v! })} />
      <ZeroField
        label="Elevación"
        value={f.elevation}
        unit="m"
        parse={parseElevation}
        format={(v) => formatMetres(v).replace(' m', '')}
        error="Escribe una altura de 0 o más, por ejemplo 0,75."
        help="Altura desde el piso hasta la base del mueble."
        onCommit={(v) => set(id, { elevation: v })}
      />
      <div className="fila-rotacion">
        <ZeroField
          label="Rotación"
          value={f.rotation}
          unit="°"
          parse={parseDegrees}
          format={(v) => String(Math.round(v * 100) / 100).replace('.', ',')}
          error="Escribe los grados, por ejemplo 90."
          onCommit={(v) => set(id, { rotation: v })}
        />
        <button className="btn btn-chico" title="Girar −90° (Shift+R)" onClick={() => set(id, { rotation: f.rotation - 90 })}>−90°</button>
        <button className="btn btn-chico" title="Girar +90° (R)" onClick={() => set(id, { rotation: f.rotation + 90 })}>
          <Icon name="rotate" size={16} />+90°
        </button>
      </div>
      <ColorField value={color} onCommit={(c) => set(id, { color: c })} />
      <div className="acciones">
        <button className="btn btn-sec" title="Ctrl+D" onClick={() => duplicateSelectedFurniture()}><Icon name="copy" size={16} />Duplicar</button>
        <button className="btn btn-sec" onClick={() => removeSelectedFurniture()}><Icon name="trash" size={16} />Eliminar</button>
      </div>
    </>
  );
}
