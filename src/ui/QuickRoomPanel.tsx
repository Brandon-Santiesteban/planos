import { useQuickRoom } from '../editor2d/tools/quickRoomTool';
import { LengthField, TextField } from './fields';
import Icon from './Icon';

/** Size of the quick room that follows the pointer. */
export default function QuickRoomPanel() {
  const { width, depth, name } = useQuickRoom();
  return (
    <section className="tarjeta">
      <h2>Habitación rápida</h2>
      <TextField label="Nombre" value={name} onCommit={(v) => useQuickRoom.setState({ name: v })} />
      <p className="hint" style={{ marginTop: -4 }}>Escríbelo antes de colocarla (Sala, Parqueadero, Patio…). Vacío: «Habitación N».</p>
      <LengthField label="Ancho (por dentro)" value={width} onCommit={(v) => useQuickRoom.setState({ width: v! })} />
      <LengthField label="Largo (por dentro)" value={depth} onCommit={(v) => useQuickRoom.setState({ depth: v! })} />
      <div className="acciones">
        <button className="btn btn-sec" onClick={() => useQuickRoom.setState({ width: depth, depth: width })}>
          <Icon name="rotate" size={16} />Girar (R)
        </button>
      </div>
      <p className="hint parrafo" style={{ marginTop: 12 }}>
        Haz clic en el plano para colocarla. Si la acercas a otra habitación se pega a ella y comparten el muro; después une
        las dos con la herramienta Puerta.
      </p>
    </section>
  );
}
