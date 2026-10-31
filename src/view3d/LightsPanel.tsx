import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { catalogItem } from '../furniture/catalog';
import { setLightOn, setRoomLightOn } from '../model/furnitureOps';
import { useEditor } from '../store/editorStore';
import Icon from '../ui/Icon';

/**
 * «Luces» in the 3D bar: every light fitting of the floor being edited, each with a switch, so the user picks which
 * stay on. Clicking a name selects that light (its outline shows it in the view). Saved with the project.
 */
export default function LightsPanel() {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  // The panel floats over the whole page (a narrow 3D pane in «Dividir» would clip it), above its button and kept
  // inside the window.
  const [place, setPlace] = useState<CSSProperties>({});
  useLayoutEffect(() => {
    if (!open) return;
    const fit = () => {
      const r = button.current?.getBoundingClientRect();
      if (!r) return;
      const w = Math.min(300, window.innerWidth - 16);
      setPlace({
        width: w,
        left: Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)),
        bottom: window.innerHeight - r.top + 10,
        maxHeight: Math.max(160, Math.min(360, r.top - 18)),
      });
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [open]);
  const floor = useEditor((s) => s.project.floors.find((f) => f.id === s.activeFloorId));
  const selectedId = useEditor((s) => (s.selection?.kind === 'furniture' ? s.selection.id : null));
  const lights = (floor?.furniture ?? []).filter((f) => catalogItem(f.type)?.light !== undefined);
  // Every room has a main ceiling light in its middle (drawn by the 3D view, not a piece of furniture).
  const rooms = (floor?.rooms ?? []).filter((r) => r.kind === 'room');
  // Grouped by kind, each kind numbered in plan order (top to bottom, left to right), so «Luz empotrada 2» is stable.
  const label = (type: string) => catalogItem(type)!.name.replace(/\s*\(.*\)$/, '');
  const count = new Map<string, number>();
  const named = [...lights]
    .sort((a, b) => label(a.type).localeCompare(label(b.type)) || a.y - b.y || a.x - b.x)
    .map((f) => {
      const n = (count.get(f.type) ?? 0) + 1;
      count.set(f.type, n);
      const total = lights.filter((x) => x.type === f.type).length;
      return { f, name: `${label(f.type)}${total > 1 ? ` ${n}` : ''}` };
    });
  const toggle = (id: string, on: boolean) => {
    const { apply, activeFloorId } = useEditor.getState();
    apply((d) => setLightOn(d, activeFloorId, id, on));
  };
  const toggleRoom = (id: string, on: boolean) => {
    const { apply, activeFloorId } = useEditor.getState();
    apply((d) => setRoomLightOn(d, activeFloorId, id, on));
  };
  const all = (on: boolean) => {
    const { apply, activeFloorId } = useEditor.getState();
    apply((d) => {
      rooms.forEach((r) => setRoomLightOn(d, activeFloorId, r.id, on));
      lights.forEach((f) => setLightOn(d, activeFloorId, f.id, on));
    });
  };
  return (
    <div className="luces">
      <button ref={button} type="button" className="btn btn-chico" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="bulb" size={16} />Luces
      </button>
      {open && createPortal(
        <div className="panel-luces" role="dialog" aria-label="Luces" style={place}>
          <div className="panel-luces-cabeza">
            <strong>Luces de esta planta</strong>
            <span>
              <button type="button" className="btn-texto" onClick={() => all(true)}>Todas</button>
              <button type="button" className="btn-texto" onClick={() => all(false)}>Ninguna</button>
            </span>
          </div>
          {named.length === 0 && rooms.length === 0 && <p className="hint">No hay luces en esta planta. Agrégalas desde Muebles → Iluminación.</p>}
          <ul>
            {rooms.map((r) => (
              <li key={r.id}>
                <label>
                  <input type="checkbox" checked={!r.lightOff} onChange={(e) => toggleRoom(r.id, e.target.checked)} />
                  <span className="muestra" style={{ background: r.lightOff ? 'transparent' : '#ffd08a' }} />
                  <span>Luz principal{rooms.length > 1 ? ` · ${r.name}` : ''}</span>
                </label>
              </li>
            ))}
            {named.map(({ f, name }) => (
              <li key={f.id} className={f.id === selectedId ? 'activa' : undefined}>
                <label>
                  <input type="checkbox" checked={!f.off} onChange={(e) => toggle(f.id, e.target.checked)} />
                  <span className="muestra" style={{ background: f.off ? 'transparent' : (f.color ?? catalogItem(f.type)!.color) }} />
                </label>
                <button type="button" className="btn-texto" onClick={() => useEditor.getState().select({ kind: 'furniture', id: f.id })}>
                  {name}
                </button>
              </li>
            ))}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}
