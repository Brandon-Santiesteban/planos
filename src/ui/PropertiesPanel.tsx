import { polygonArea } from '../geometry/polygons';
import { wallLength } from '../geometry/walls';
import {
  deleteOpening, deleteRoom, deleteWall, renameRoom, setRoofHeight, setRoomKind, setWallLength, updateOpening, updateWall,
} from '../model/ops';
import type { Floor, Project, RoomKind } from '../model/types';
import { formatArea } from '../model/units';
import { useEditor } from '../store/editorStore';
import CatalogPanel from '../furniture/CatalogPanel';
import FurnitureProps from '../furniture/FurnitureProps';
import BackgroundControls from './BackgroundControls';
import { LengthField, TextField } from './fields';
import OrientationPanel from './OrientationPanel';
import QuickRoomPanel from './QuickRoomPanel';
import Icon from './Icon';
import SegmentedSwitch from './SegmentedSwitch';
import { notify } from './toasts';

type Recipe = (d: Project, floorId: string) => void;

function edit(recipe: Recipe) {
  const { apply, activeFloorId } = useEditor.getState();
  apply((d) => recipe(d, activeFloorId));
}

/** Deletes right away and offers Deshacer in the notification (no red button outside a confirmation). */
function remove(message: string, recipe: Recipe) {
  edit(recipe);
  useEditor.getState().select(null);
  notify({ kind: 'info', text: message, action: { label: 'Deshacer', run: () => useEditor.getState().undo() } });
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="acciones">
      <button className="btn btn-sec" onClick={onClick}><Icon name="trash" size={16} />Eliminar</button>
    </div>
  );
}

function WallProps({ floor, id }: { floor: Floor; id: string }) {
  const w = floor.walls.find((x) => x.id === id);
  if (!w) return null;
  return (
    <>
      <h2>Muro</h2>
      <LengthField label="Longitud" value={wallLength(w)} onCommit={(v) => edit((d, f) => void setWallLength(d, f, id, v!))} />
      <LengthField label="Grosor" value={w.thickness} onCommit={(v) => edit((d, f) => void updateWall(d, f, id, { thickness: v! }))} />
      <LengthField
        label="Altura"
        value={w.height}
        allowEmpty
        placeholder={`${floor.height.toFixed(2).replace('.', ',')} (la de la planta)`}
        help="Déjalo vacío para usar la altura de la planta."
        onCommit={(v) => edit((d, f) => void updateWall(d, f, id, { height: v }))}
      />
      <DeleteButton onClick={() => remove('Muro eliminado', (d, f) => deleteWall(d, f, id))} />
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
      {o.kind === 'window' && <LengthField label="Antepecho" value={o.sill} help="Altura desde el suelo hasta la ventana." onCommit={(v) => set({ sill: v! })} />}
      <LengthField label="Posición desde el inicio" value={o.offset} onCommit={(v) => set({ offset: v! })} />
      <p className="hint parrafo">Si una medida no cabe en el muro, se deja la que tenía.</p>
      <DeleteButton onClick={() => remove(o.kind === 'door' ? 'Puerta eliminada' : 'Ventana eliminada', (d, f) => deleteOpening(d, f, id))} />
    </>
  );
}

function RoomProps({ floor, id }: { floor: Floor; id: string }) {
  const r = floor.rooms.find((x) => x.id === id);
  if (!r) return null;
  return (
    <>
      <h2>{r.kind === 'balcony' ? 'Balcón' : r.kind === 'roof' ? 'Cubierta' : 'Habitación'}</h2>
      <TextField label="Nombre" value={r.name} onCommit={(v) => edit((d, f) => renameRoom(d, f, id, v))} />
      <div className="field">
        <span className="label">Tipo</span>
        <SegmentedSwitch<RoomKind>
          label="Tipo"
          value={r.kind}
          options={[{ value: 'room', label: 'Habitación' }, { value: 'balcony', label: 'Balcón' }, { value: 'roof', label: 'Cubierta' }]}
          onChange={(k) => edit((d, f) => setRoomKind(d, f, id, k))}
        />
      </div>
      {r.kind === 'roof' && (
        <LengthField
          label="Altura de la cubierta"
          value={r.height ?? floor.height}
          help="Desde el piso. Si queda por encima de los muros, entre ellos y el techo queda un espacio abierto."
          onCommit={(v) => edit((d, f) => setRoofHeight(d, f, id, v!))}
        />
      )}
      <div className="field">
        <span className="etiqueta-tarjeta" style={{ margin: 0 }}>Área</span>
        <span className="valor-fijo">{formatArea(polygonArea(r.points))}</span>
      </div>
      <DeleteButton onClick={() => remove(r.kind === 'balcony' ? 'Balcón eliminado' : r.kind === 'roof' ? 'Cubierta eliminada' : 'Habitación eliminada', (d, f) => deleteRoom(d, f, id))} />
    </>
  );
}

export default function PropertiesPanel() {
  const project = useEditor((s) => s.project);
  const activeFloorId = useEditor((s) => s.activeFloorId);
  const selection = useEditor((s) => s.selection);
  const tool = useEditor((s) => s.tool);
  const floor = project.floors.find((f) => f.id === activeFloorId) ?? project.floors[0];

  if (tool === 'quickRoom') return <QuickRoomPanel />;
  if (tool === 'furniture') return <CatalogPanel />;

  if (!selection) {
    return (
      <>
        <section className="tarjeta properties">
          <h3>Propiedades</h3>
          <p className="hint parrafo">Selecciona un muro, una puerta, una ventana, una habitación o un mueble para ver y cambiar sus medidas.</p>
        </section>
        <section className="tarjeta">
          <OrientationPanel />
        </section>
        <section className="tarjeta">
          <BackgroundControls floor={floor} />
        </section>
      </>
    );
  }
  return (
    <section className="tarjeta properties">
      {selection.kind === 'wall' && <WallProps key={selection.id} floor={floor} id={selection.id} />}
      {selection.kind === 'opening' && <OpeningProps key={selection.id} floor={floor} id={selection.id} />}
      {selection.kind === 'room' && <RoomProps key={selection.id} floor={floor} id={selection.id} />}
      {selection.kind === 'furniture' && <FurnitureProps key={selection.id} floor={floor} id={selection.id} />}
    </section>
  );
}
