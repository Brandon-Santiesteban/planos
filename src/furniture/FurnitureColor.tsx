import { useEffect, useId, useRef, useState } from 'react';
import { setFurnitureColor } from '../model/furnitureOps';
import type { Floor } from '../model/types';
import { useEditor } from '../store/editorStore';
import Icon from '../ui/Icon';
import { catalogItem } from './catalog';

/** Named finishes, by family. Any other colour can be picked with «Otro color» or typed as #rrggbb. */
export const PALETTE: { family: string; colors: [string, string][] }[] = [
  {
    family: 'Maderas',
    colors: [['#e3cba5', 'Maple'], ['#d8b98c', 'Roble claro'], ['#b08a63', 'Roble'], ['#9c6b3c', 'Teca'], ['#7a5a3f', 'Nogal'], ['#4a3428', 'Wengué']],
  },
  {
    family: 'Neutros',
    colors: [['#f7f5f0', 'Blanco'], ['#eeebe5', 'Hueso'], ['#d9cfc0', 'Arena'], ['#c8bca8', 'Lino'], ['#b9bec4', 'Gris perla'], ['#8d939b', 'Gris'], ['#3b3f45', 'Grafito'], ['#1d1f22', 'Negro']],
  },
  {
    family: 'Colores',
    colors: [
      ['#8a9a7b', 'Salvia'], ['#6f7f5c', 'Oliva'], ['#2f5d6b', 'Petróleo'], ['#5d6d7e', 'Azul acero'], ['#2c3e66', 'Azul marino'],
      ['#a0522d', 'Terracota'], ['#c8a24a', 'Mostaza'], ['#c9a1a0', 'Rosa viejo'], ['#6b2d34', 'Burdeos'],
    ],
  },
];
const NAMES = new Map(PALETTE.flatMap((g) => g.colors));

/** Pieces whose colour is changed, all on the active floor. */
function paint(ids: string[], color: string | null, record = true) {
  const { apply, activeFloorId } = useEditor.getState();
  apply((d) => void setFurnitureColor(d, activeFloorId, ids, color), { record });
}

function Swatch({ color, name, active, onPick }: { color: string; name?: string; active: boolean; onPick: () => void }) {
  const label = name ? `${name} (${color})` : color;
  return <button className={`muestra${active ? ' activa' : ''}`} style={{ background: color }} title={label} aria-label={label} aria-pressed={active} onClick={onPick} />;
}

/**
 * Colour of one or several selected pieces: named palette, the colours already used in the house (to match pieces),
 * a free colour picker that previews while dragging, the hex code, back to the original, and «same for all» shortcuts.
 */
export default function FurnitureColor({ floor, ids }: { floor: Floor; ids: string[] }) {
  const pieces = floor.furniture.filter((f) => ids.includes(f.id));
  const first = pieces[0];
  const fieldId = useId();
  const original = (type: string) => catalogItem(type)?.color ?? '#b08a63';
  const value = (first?.color ?? original(first?.type ?? '')).toLowerCase();
  const mixed = pieces.some((f) => (f.color ?? original(f.type)).toLowerCase() !== value);
  const [text, setText] = useState(value);
  const [invalid, setInvalid] = useState(false);
  const dragging = useRef(false);
  const project = useEditor((s) => s.project);
  useEffect(() => {
    setText(value);
    setInvalid(false);
  }, [value]);
  if (!first) return null;

  const used = [...new Set(project.floors.flatMap((fl) => fl.furniture.map((f) => f.color?.toLowerCase())).filter((c): c is string => !!c))].slice(0, 12);
  const sameType = floor.furniture.filter((f) => f.type === first.type);
  const item = catalogItem(first.type);
  const anyPainted = pieces.some((f) => f.color && f.color.toLowerCase() !== original(f.type).toLowerCase());

  const commitText = () => {
    const t = text.trim().startsWith('#') ? text.trim() : `#${text.trim()}`;
    if (t.toLowerCase() === value) return setInvalid(false);
    if (!/^#[0-9a-f]{6}$/i.test(t)) return setInvalid(true);
    setInvalid(false);
    paint(ids, t);
  };

  return (
    <div className="field color-mueble">
      <label htmlFor={fieldId}>Color</label>
      <div className="color-actual">
        <span className="muestra-grande" style={{ background: mixed ? 'conic-gradient(#b08a63 0 25%, #3b3f45 0 50%, #8a9a7b 0 75%, #eeebe5 0)' : value }} />
        <span className="color-nombre">
          <strong>{mixed ? 'Varios colores' : NAMES.get(value) ?? 'Color propio'}</strong>
          {!mixed && <span className="hint">{value}</span>}
        </span>
        {/* Native picker: previews while dragging (one undo step for the whole drag). */}
        <label className="btn btn-chico otro-color" title="Elegir cualquier color">
          <Icon name="sparkle" size={16} />Otro color
          <input
            type="color"
            value={value}
            onInput={(e) => {
              if (!dragging.current) {
                useEditor.getState().checkpoint();
                dragging.current = true;
              }
              paint(ids, (e.target as HTMLInputElement).value, false);
            }}
            onChange={() => { dragging.current = false; }}
            onBlur={() => { dragging.current = false; }}
          />
        </label>
      </div>
      {PALETTE.map((g) => (
        <div key={g.family} className="familia-color">
          <span className="hint">{g.family}</span>
          <div className="muestras" role="group" aria-label={g.family}>
            {g.colors.map(([c, name]) => <Swatch key={c} color={c} name={name} active={!mixed && c === value} onPick={() => paint(ids, c)} />)}
          </div>
        </div>
      ))}
      {used.length > 0 && (
        <div className="familia-color">
          <span className="hint">Usados en esta casa</span>
          <div className="muestras" role="group" aria-label="Usados en esta casa">
            {used.map((c) => <Swatch key={c} color={c} name={NAMES.get(c)} active={!mixed && c === value} onPick={() => paint(ids, c)} />)}
          </div>
        </div>
      )}
      <div className="color-codigo">
        <input
          id={fieldId}
          className={invalid ? 'invalid' : ''}
          value={text}
          aria-invalid={invalid}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => { if (e.key === 'Enter') commitText(); }}
        />
        <button className="btn btn-chico" disabled={!anyPainted} onClick={() => paint(ids, null)} title="Volver al color con el que viene el mueble">
          <Icon name="undo" size={16} />Original
        </button>
      </div>
      {invalid && <span className="error">Escribe un color como #b08a63.</span>}
      {ids.length === 1 && sameType.length > 1 && (
        <button className="btn btn-chico igualar" onClick={() => paint(sameType.map((f) => f.id), value)}>
          <Icon name="copy" size={16} />Mismo color a {sameType.length === 2 ? 'los 2' : `los ${sameType.length}`} «{item?.name ?? first.type}» de esta planta
        </button>
      )}
    </div>
  );
}
