// "Acabados" for walls and "Piso" / "Baranda" for rooms, shown in the properties panel.
import { useEffect, useId, useState } from 'react';
import { applySideToFacade, setFloorColor, setFloorMaterial, setRailing, setRailingColor, setWallSide } from '../model/materialOps';
import type { Floor, FloorMaterial, Project, RailingType, Room, Wall, WallFinish, WallSide } from '../model/types';
import { useEditor } from '../store/editorStore';
import SegmentedSwitch from '../ui/SegmentedSwitch';
import { notify } from '../ui/toasts';
import { FLOOR_MATERIALS, FLOOR_MATERIAL_ORDER, WALL_FINISHES, WALL_FINISH_ORDER } from './catalog';
import { normalizeHex, SWATCHES } from './colors';
import MaterialDropdown from './MaterialDropdown';
import { RAIL_METAL, RAIL_WOOD } from './railing';
import { faceRoom, isOutsideFace, type Side } from './wallFaces';

function edit(recipe: (d: Project, floorId: string) => void) {
  const { apply, activeFloorId } = useEditor.getState();
  apply((d) => recipe(d, activeFloorId));
}

const finishOptions = WALL_FINISH_ORDER.map((v) => ({ value: v, label: WALL_FINISHES[v].label, chip: WALL_FINISHES[v].chip }));
const floorOptions = FLOOR_MATERIAL_ORDER.map((v) => ({ value: v, label: FLOOR_MATERIALS[v].label, chip: FLOOR_MATERIALS[v].chip }));

/** Swatches plus a hex field. `value` is the current colour (may be undefined = default). */
export function ColorPicker({ label, value, onPick }: { label: string; value: string | undefined; onPick: (hex: string) => void }) {
  const id = useId();
  const current = value ? normalizeHex(value) : null;
  const [text, setText] = useState(current ?? '');
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setText(current ?? '');
    setInvalid(false);
  }, [current]);
  const commit = () => {
    const hex = normalizeHex(text);
    if (text.trim() === '' || (hex && hex === current)) {
      setText(current ?? '');
      setInvalid(false);
      return;
    }
    if (!hex) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onPick(hex);
  };
  return (
    <div className="selector-color">
      <div className="muestras" role="group" aria-label={label}>
        {SWATCHES.map((s) => (
          <button
            key={s.hex}
            type="button"
            className="muestra"
            style={{ background: s.hex }}
            title={s.label}
            aria-label={s.label}
            aria-pressed={current === s.hex}
            onClick={() => current !== s.hex && onPick(s.hex)}
          />
        ))}
      </div>
      <div className="hex">
        <span className="muestra-actual" style={{ background: current ?? 'transparent' }} aria-hidden="true" />
        <input
          id={id}
          className={invalid ? 'invalid' : ''}
          value={text}
          placeholder="#E4D9C6"
          aria-label={`Código de ${label.charAt(0).toLowerCase()}${label.slice(1)}`}
          aria-invalid={invalid}
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
        />
      </div>
      {invalid && <span className="error">Escribe un color como #E4D9C6 (6 cifras de 0 a 9 y letras de la A a la F).</span>}
    </div>
  );
}

function FaceEditor({ floor, wall, side, name }: { floor: Floor; wall: Wall; side: Side; name: 'A' | 'B' }) {
  const value: WallSide = wall.sides?.[side] ?? {};
  const room = faceRoom(floor, wall, side);
  const outside = isOutsideFace(floor, wall, side);
  const set = (patch: WallSide) => edit((d, f) => void setWallSide(d, f, wall.id, side, patch));
  const toFacade = () => {
    let n = 0;
    edit((d, f) => { n = applySideToFacade(d, f, { ...value, finish: value.finish ?? 'pintura' }); });
    notify({ kind: 'ok', text: `Acabado aplicado a ${n} caras de la fachada`, action: { label: 'Deshacer', run: () => useEditor.getState().undo() } });
  };
  return (
    <div className="cara">
      <div className="cara-titulo">
        <span className="cara-nombre">{`Cara ${name}`}</span>
        <span className="cara-donde">{room && room.kind !== 'balcony' ? `Mira a ${room.name}` : room ? `Mira a ${room.name} (exterior)` : 'Mira al exterior'}</span>
      </div>
      <div className="field">
        <span className="label">Acabado</span>
        <MaterialDropdown<WallFinish>
          label={`Acabado de la cara ${name}`}
          value={value.finish ?? 'pintura'}
          options={finishOptions}
          onChange={(finish) => set({ finish })}
        />
      </div>
      <div className="field">
        <span className="label">{value.finish && value.finish !== 'pintura' ? 'Tono' : 'Color'}</span>
        <ColorPicker label={`Color de la cara ${name}`} value={value.color} onPick={(color) => set({ color })} />
      </div>
      {outside && (
        <button type="button" className="btn btn-chico" onClick={toFacade}>Usar en toda la fachada</button>
      )}
    </div>
  );
}

/** Finish and colour of both faces of a wall. Cara A is the left side walking from the wall's start to its end. */
export function WallFinishes({ floor, wall }: { floor: Floor; wall: Wall }) {
  return (
    <section className="acabados">
      <h3>Acabados</h3>
      <FaceEditor floor={floor} wall={wall} side="left" name="A" />
      <FaceEditor floor={floor} wall={wall} side="right" name="B" />
    </section>
  );
}

const RAIL_COLOR_LABEL: Record<RailingType, string> = {
  vidrio: 'Color del metal',
  muro: 'Color del muro',
  celosia: 'Color de la celosía',
};

/** Floor finish for rooms and balconies, and the railing for balconies. */
export function RoomMaterials({ room }: { room: Room }) {
  if (room.kind !== 'room' && room.kind !== 'balcony') return null;
  const railing = room.railing ?? 'vidrio';
  return (
    <>
      <div className="field">
        <span className="label">Piso</span>
        <MaterialDropdown<FloorMaterial>
          label="Piso"
          value={room.floorMaterial}
          options={floorOptions}
          onChange={(m) => edit((d, f) => setFloorMaterial(d, f, room.id, m))}
        />
      </div>
      {room.floorMaterial && (
        <div className="field">
          <span className="label">Color del piso</span>
          <ColorPicker
            label="Color del piso"
            value={room.floorColor ?? FLOOR_MATERIALS[room.floorMaterial].chip}
            onPick={(c) => edit((d, f) => void setFloorColor(d, f, room.id, c))}
          />
        </div>
      )}
      {room.kind === 'balcony' && (
        <>
          <div className="field">
            <span className="label">Baranda</span>
            <SegmentedSwitch<RailingType>
              label="Baranda"
              value={railing}
              options={[{ value: 'vidrio', label: 'Vidrio' }, { value: 'muro', label: 'Muro' }, { value: 'celosia', label: 'Celosía' }]}
              onChange={(r) => edit((d, f) => setRailing(d, f, room.id, r))}
            />
            <span className="ayuda">
              {railing === 'celosia'
                ? 'Listones horizontales. En la planta baja es un cerramiento de 2 m sobre un muro de 0,6 m.'
                : railing === 'muro' ? 'Muro macizo de 1 m con remate.' : 'Vidrio de 1 m con pasamanos.'}
            </span>
          </div>
          <div className="field">
            <span className="label">{RAIL_COLOR_LABEL[railing]}</span>
            <ColorPicker
              label={RAIL_COLOR_LABEL[railing]}
              value={room.railingColor ?? (railing === 'vidrio' ? RAIL_METAL : railing === 'celosia' ? RAIL_WOOD : undefined)}
              onPick={(c) => edit((d, f) => void setRailingColor(d, f, room.id, c))}
            />
          </div>
        </>
      )}
    </>
  );
}
