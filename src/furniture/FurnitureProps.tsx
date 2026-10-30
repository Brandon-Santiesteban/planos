import { useEffect, useId, useState } from 'react';
import { fitToWall, setGateOpen, updateFurniture, type FurniturePatch } from '../model/furnitureOps';
import type { Floor } from '../model/types';
import { formatMetres, parseLength } from '../model/units';
import { useEditor } from '../store/editorStore';
import { LengthField } from '../ui/fields';
import Icon from '../ui/Icon';
import { notify } from '../ui/toasts';
import { duplicateSelectedFurniture, removeSelectedFurniture } from './actions';
import { catalogItem } from './catalog';
import { Thumb } from './CatalogPanel';
import FurnitureColor from './FurnitureColor';

function fit(id: string) {
  const { apply, activeFloorId } = useEditor.getState();
  let ok = false;
  apply((d) => {
    ok = fitToWall(d, activeFloorId, id, { toCeiling: true });
  });
  if (!ok) notify({ kind: 'warn', text: 'No hay un muro cerca para encajarlo', detail: 'Acércalo a menos de 1 m del muro donde va.' });
}

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

export default function FurnitureProps({ floor, id }: { floor: Floor; id: string }) {
  const f = floor.furniture.find((x) => x.id === id);
  if (!f) return null;
  const item = catalogItem(f.type);
  return (
    <>
      <div className="mueble-encabezado">
        {item && <Thumb item={item} size={40} />}
        <div>
          <h2>{item?.name ?? f.type}</h2>
          {item && <span className="hint">{item.category}</span>}
        </div>
      </div>
      {item?.model === 'porton' && (
        <label className="toggle-linea">
          <input
            type="checkbox"
            checked={f.open === true}
            onChange={(e) => {
              const { apply, activeFloorId } = useEditor.getState();
              apply((d) => setGateOpen(d, activeFloorId, id, e.target.checked));
            }}
          />
          Portón abierto
        </label>
      )}
      {(item?.model === 'closet' || item?.model === 'vestier') && (
        <div className="field">
          <button className="btn btn-sec" onClick={() => fit(id)}><Icon name="maximize" size={16} />Encajar en el muro</button>
          <span className="ayuda">Lo pega al muro que tiene detrás (de mampostería o drywall) y lo estira de esquina a esquina y hasta el techo, sin tapar puertas.</span>
        </div>
      )}
      <FurnitureColor floor={floor} ids={[id]} />
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
      <div className="fila-rotacion">
        <ZeroField
          label="Inclinación (eje X)"
          value={f.tilt ?? 0}
          unit="°"
          parse={parseDegrees}
          format={(v) => String(Math.round(v * 100) / 100).replace('.', ',')}
          error="Escribe los grados, por ejemplo 90."
          help="Lo voltea sobre su eje de ancho: 90° lo acuesta de espaldas, 180° lo pone de cabeza."
          onCommit={(v) => set(id, { tilt: v })}
        />
        <button className="btn btn-chico" title="Inclinar −90° en el eje X" onClick={() => set(id, { tilt: (f.tilt ?? 0) - 90 })}>−90° X</button>
        <button className="btn btn-chico" title="Inclinar +90° en el eje X" onClick={() => set(id, { tilt: (f.tilt ?? 0) + 90 })}>
          <Icon name="rotate" size={16} />+90° X
        </button>
      </div>
      <div className="acciones">
        <button className="btn btn-sec" title="Ctrl+D, o Ctrl+C y Ctrl+V" onClick={() => duplicateSelectedFurniture()}><Icon name="copy" size={16} />Duplicar</button>
        <button className="btn btn-sec" onClick={() => removeSelectedFurniture()}><Icon name="trash" size={16} />Eliminar</button>
      </div>
    </>
  );
}
