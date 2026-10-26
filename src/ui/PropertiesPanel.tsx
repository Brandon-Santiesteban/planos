import { useId } from 'react';
import { polygonArea } from '../geometry/polygons';
import { wallLength } from '../geometry/walls';
import {
  deleteOpening, deleteRoom, deleteWall, renameRoom, setRoomKind, setWallLength, updateOpening, updateWall,
} from '../model/ops';
import type { Floor, Project, RoomKind } from '../model/types';
import { formatArea } from '../model/units';
import { useEditor } from '../store/editorStore';
import BackgroundControls from './BackgroundControls';
import { LengthField, TextField } from './fields';

type Recipe = (d: Project, floorId: string) => void;

function edit(recipe: Recipe) {
  const { apply, activeFloorId } = useEditor.getState();
  apply((d) => recipe(d, activeFloorId));
}

function remove(recipe: Recipe) {
  edit(recipe);
  useEditor.getState().select(null);
}

function WallProps({ floor, id }: { floor: Floor; id: string }) {
  const w = floor.walls.find((x) => x.id === id);
  if (!w) return null;
  return (
    <>
      <h2>Muro</h2>
      <LengthField label="Longitud" value={wallLength(w)} onCommit={(v) => edit((d, f) => setWallLength(d, f, id, v!))} />
      <LengthField label="Grosor" value={w.thickness} onCommit={(v) => edit((d, f) => updateWall(d, f, id, { thickness: v! }))} />
      <LengthField
        label="Altura"
        value={w.height}
        allowEmpty
        placeholder={`${floor.height.toFixed(2).replace('.', ',')} (planta)`}
        onCommit={(v) => edit((d, f) => updateWall(d, f, id, { height: v }))}
      />
      <button className="danger" onClick={() => remove((d, f) => deleteWall(d, f, id))}>Eliminar</button>
    </>
  );
}

function OpeningProps({ floor, id }: { floor: Floor; id: string }) {
  const o = floor.openings.find((x) => x.id === id);
  if (!o) return null;
  const set = (patch: Parameters<typeof updateOpening>[3]) => edit((d, f) => void updateOpening(d, f, id, patch));
  return (
    <>
      <h2>{o.kind === 'door' ? 'Puerta' : 'Ventana'}</h2>
      <LengthField label="Ancho" value={o.width} onCommit={(v) => set({ width: v! })} />
      <LengthField label="Alto" value={o.height} onCommit={(v) => set({ height: v! })} />
      {o.kind === 'window' && <LengthField label="Antepecho" value={o.sill} onCommit={(v) => set({ sill: v! })} />}
      <LengthField label="Posición desde el inicio" value={o.offset} onCommit={(v) => set({ offset: v! })} />
      <p className="hint">Si la medida no cabe en el muro, no se aplica.</p>
      <button className="danger" onClick={() => remove((d, f) => deleteOpening(d, f, id))}>Eliminar</button>
    </>
  );
}

function RoomProps({ floor, id }: { floor: Floor; id: string }) {
  const kindId = useId();
  const r = floor.rooms.find((x) => x.id === id);
  if (!r) return null;
  return (
    <>
      <h2>{r.kind === 'balcony' ? 'Balcón' : 'Habitación'}</h2>
      <TextField label="Nombre" value={r.name} onCommit={(v) => edit((d, f) => renameRoom(d, f, id, v))} />
      <div className="field">
        <label htmlFor={kindId}>Tipo</label>
        <select id={kindId} value={r.kind} onChange={(e) => edit((d, f) => setRoomKind(d, f, id, e.target.value as RoomKind))}>
          <option value="room">Habitación</option>
          <option value="balcony">Balcón</option>
        </select>
      </div>
      <div className="field">
        <span className="label">Área</span>
        <strong>{formatArea(polygonArea(r.points))}</strong>
      </div>
      <button className="danger" onClick={() => remove((d, f) => deleteRoom(d, f, id))}>Eliminar</button>
    </>
  );
}

export default function PropertiesPanel() {
  const project = useEditor((s) => s.project);
  const activeFloorId = useEditor((s) => s.activeFloorId);
  const selection = useEditor((s) => s.selection);
  const floor = project.floors.find((f) => f.id === activeFloorId) ?? project.floors[0];

  return (
    <aside className="properties">
      {selection?.kind === 'wall' && <WallProps key={selection.id} floor={floor} id={selection.id} />}
      {selection?.kind === 'opening' && <OpeningProps key={selection.id} floor={floor} id={selection.id} />}
      {selection?.kind === 'room' && <RoomProps key={selection.id} floor={floor} id={selection.id} />}
      {!selection && (
        <>
          <h2>Propiedades</h2>
          <p className="hint">Selecciona un muro, una puerta, una ventana o una habitación.</p>
          <BackgroundControls floor={floor} />
        </>
      )}
    </aside>
  );
}
