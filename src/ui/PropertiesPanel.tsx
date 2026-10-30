import { polygonArea } from '../geometry/polygons';
import FurnitureColor from '../furniture/FurnitureColor';
import { wallLength } from '../geometry/walls';
import { RoomMaterials, WallFinishes } from '../materials/MaterialPanels';
import {
  deleteItems, deleteOpening, deleteRoom, deleteWall, rectRoomSize, renameRoom, resizeRectRoom, setRoofHeight, setRoomKind, setStairShape, setStairUp, setWallLength,
  toggleDoorFlip, setDoorGlass, updateOpening, updateWall,
} from '../model/ops';
import type { Floor, Project, Room, RoomKind, StairShape, StairUp } from '../model/types';
import { formatArea } from '../model/units';
import { useEditor } from '../store/editorStore';
import CatalogPanel from '../furniture/CatalogPanel';
import FurnitureProps from '../furniture/FurnitureProps';
import BackgroundControls from './BackgroundControls';
import Dropdown from './Dropdown';
import { LengthField, TextField } from './fields';
import OrientationPanel from './OrientationPanel';
import QuickRoomPanel from './QuickRoomPanel';
import SitePanel from './SitePanel';
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
      <WallFinishes floor={floor} wall={w} />
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
      {o.kind === 'door' && (
        <div className="acciones">
          <button className="btn btn-sec" onClick={() => edit((d, f) => toggleDoorFlip(d, f, id))}><Icon name="flip" size={16} />Invertir apertura</button>
        </div>
      )}
      {o.kind === 'door' && (
        <label className="toggle-linea">
          <input type="checkbox" checked={o.glass === true} onChange={(e) => edit((d, f) => setDoorGlass(d, f, id, e.target.checked))} />
          Puerta de vidrio
        </label>
      )}
      <DeleteButton onClick={() => remove(o.kind === 'door' ? 'Puerta eliminada' : 'Ventana eliminada', (d, f) => deleteOpening(d, f, id))} />
    </>
  );
}

const KIND_NAMES: Record<RoomKind, string> = { room: 'Habitación', balcony: 'Balcón', roof: 'Cubierta', stairs: 'Escalera', exterior: 'Exterior' };
const KIND_REMOVED: Record<RoomKind, string> = {
  room: 'Habitación eliminada', balcony: 'Balcón eliminado', roof: 'Cubierta eliminada', stairs: 'Escalera eliminada', exterior: 'Zona exterior eliminada',
};

function StairsFields({ r, id }: { r: Room; id: string }) {
  return (
    <>
      <div className="field">
        <span className="label">Sube hacia</span>
        <Dropdown<StairUp>
          label="Sube hacia"
          value={r.up ?? 'n'}
          options={[{ value: 'n', label: 'Arriba' }, { value: 's', label: 'Abajo' }, { value: 'w', label: 'Izquierda' }, { value: 'e', label: 'Derecha' }]}
          onChange={(u) => edit((d, f) => setStairUp(d, f, id, u))}
        />
        <span className="ayuda">Arriba, abajo, izquierda o derecha del plano.</span>
      </div>
      <div className="field">
        <span className="label">Forma</span>
        <SegmentedSwitch<StairShape>
          label="Forma"
          value={r.stairShape ?? 'recta'}
          options={[{ value: 'recta', label: 'Recta' }, { value: 'u', label: 'En U' }]}
          onChange={(sh) => edit((d, f) => setStairShape(d, f, id, sh))}
        />
      </div>
    </>
  );
}

/** Width and length of a rectangular room: typing a new value moves its right or bottom side with the walls on it. */
function RectSize({ r, id }: { r: Room; id: string }) {
  const size = rectRoomSize(r);
  if (!size) return null;
  return (
    <>
      <LengthField label="Ancho (por dentro)" value={size.width} onCommit={(v) => edit((d, f) => void resizeRectRoom(d, f, id, { width: v! }))} />
      <LengthField
        label="Largo (por dentro)"
        value={size.depth}
        help="Se mueve el lado derecho o el de abajo, con sus muros. También puedes arrastrar un muro en el plano."
        onCommit={(v) => edit((d, f) => void resizeRectRoom(d, f, id, { depth: v! }))}
      />
    </>
  );
}

function RoomProps({ floor, id }: { floor: Floor; id: string }) {
  const r = floor.rooms.find((x) => x.id === id);
  if (!r) return null;
  return (
    <>
      <h2>{KIND_NAMES[r.kind]}</h2>
      <TextField label="Nombre" value={r.name} onCommit={(v) => edit((d, f) => renameRoom(d, f, id, v))} />
      <RectSize r={r} id={id} />
      <div className="field">
        <span className="label">Tipo</span>
        <Dropdown<RoomKind>
          label="Tipo"
          value={r.kind}
          options={(Object.keys(KIND_NAMES) as RoomKind[]).map((k) => ({ value: k, label: KIND_NAMES[k] }))}
          onChange={(k) => edit((d, f) => setRoomKind(d, f, id, k))}
        />
      </div>
      {r.kind === 'stairs' && <StairsFields r={r} id={id} />}
      {r.kind === 'roof' && (
        <LengthField
          label="Altura de la cubierta"
          value={r.height ?? floor.height}
          help="Desde el piso. Si queda por encima de los muros, entre ellos y el techo queda un espacio abierto."
          onCommit={(v) => edit((d, f) => setRoofHeight(d, f, id, v!))}
        />
      )}
      <RoomMaterials room={r} />
      <div className="field">
        <span className="etiqueta-tarjeta" style={{ margin: 0 }}>Área</span>
        <span className="valor-fijo">{formatArea(polygonArea(r.points))}</span>
      </div>
      <DeleteButton onClick={() => remove(KIND_REMOVED[r.kind], (d, f) => deleteRoom(d, f, id))} />
    </>
  );
}

export default function PropertiesPanel() {
  const project = useEditor((s) => s.project);
  const activeFloorId = useEditor((s) => s.activeFloorId);
  const selection = useEditor((s) => s.selection);
  const group = useEditor((s) => s.group);
  const tool = useEditor((s) => s.tool);
  const floor = project.floors.find((f) => f.id === activeFloorId) ?? project.floors[0];

  if (tool === 'quickRoom') return <QuickRoomPanel />;
  if (tool === 'furniture') return <CatalogPanel />;

  if (group.length) {
    const pieces = group.filter((g) => g.kind === 'furniture').map((g) => g.id);
    return (
      <section className="tarjeta properties">
        <h2>{group.length} elementos seleccionados</h2>
        <p className="hint parrafo">Pulsa Supr para borrarlos todos, o haz clic en un espacio vacío para soltar la selección.</p>
        {pieces.length > 0 && (
          <>
            {pieces.length < group.length && <p className="hint">El color se aplica a los {pieces.length} muebles de la selección.</p>}
            <FurnitureColor floor={floor} ids={pieces} />
          </>
        )}
        <DeleteButton onClick={() => remove(`${group.length} elementos eliminados`, (d, f) => deleteItems(d, f, group))} />
      </section>
    );
  }
  if (!selection) {
    return (
      <>
        <section className="tarjeta properties">
          <h3>Propiedades</h3>
          <p className="hint parrafo">Selecciona un muro, una puerta, una ventana, una habitación o un mueble para ver y cambiar sus medidas.</p>
        </section>
        <section className="tarjeta">
          <SitePanel />
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
