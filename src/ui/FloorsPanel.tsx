import { useState } from 'react';
import { addFloor, deleteFloor, moveFloor, renameFloor, setFloorHeight } from '../model/ops';
import { useEditor } from '../store/editorStore';
import { askConfirm } from './Dialog';
import { LengthField } from './fields';
import Icon from './Icon';

/** Short level badge: B for the ground floor, then 1, 2… */
const level = (i: number) => (i === 0 ? 'B' : String(i));

export default function FloorsPanel() {
  const floors = useEditor((s) => s.project.floors);
  const activeFloorId = useEditor((s) => s.activeFloorId);
  const [renaming, setRenaming] = useState<string | null>(null);
  const active = floors.find((f) => f.id === activeFloorId) ?? floors[0];
  const index = floors.indexOf(active);

  const add = () => {
    let id = '';
    useEditor.getState().apply((d) => {
      id = addFloor(d);
    });
    useEditor.getState().setActiveFloor(id);
  };

  const remove = async () => {
    const ok = await askConfirm({
      title: `¿Eliminar «${active.name}»?`,
      text: 'Se borrarán sus muros, puertas, ventanas, habitaciones y plano de fondo. Puedes recuperarla con Deshacer.',
      confirmLabel: 'Eliminar planta',
      danger: true,
    });
    if (!ok) return;
    const below = index > 0 ? floors[index - 1].id : floors[1]?.id;
    useEditor.getState().apply((d) => void deleteFloor(d, active.id));
    if (below) useEditor.getState().setActiveFloor(below);
  };

  const finishRename = (id: string, name: string) => {
    setRenaming(null);
    const n = name.trim();
    if (n) useEditor.getState().apply((d) => renameFloor(d, id, n));
  };

  return (
    <section className="tarjeta floors-panel">
      <h3>Plantas</h3>
      <ul>
        {[...floors].reverse().map((f) => {
          const i = floors.indexOf(f);
          return (
            <li
              key={f.id}
              className={f.id === activeFloorId ? 'active' : ''}
              onClick={() => useEditor.getState().setActiveFloor(f.id)}
              onDoubleClick={() => setRenaming(f.id)}
              title="Doble clic para cambiar el nombre"
            >
              <span className="nivel">{level(i)}</span>
              {renaming === f.id ? (
                <input
                  autoFocus
                  defaultValue={f.name}
                  onBlur={(e) => finishRename(f.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') finishRename(f.id, e.currentTarget.value);
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                />
              ) : (
                <span className="floor-name">{f.name}</span>
              )}
            </li>
          );
        })}
      </ul>
      <LengthField
        key={active.id}
        label={`Altura de ${active.name}`}
        value={active.height}
        onCommit={(v) => useEditor.getState().apply((d) => void setFloorHeight(d, active.id, v!))}
      />
      <div className="floor-buttons">
        <button className="btn btn-chico" onClick={add}><Icon name="plus" size={16} />Añadir planta</button>
        <button className="btn btn-chico" onClick={remove} disabled={floors.length <= 1} title={floors.length <= 1 ? 'Debe quedar al menos una planta' : undefined}>
          <Icon name="trash" size={16} />Eliminar
        </button>
        <button
          className="btn btn-chico"
          onClick={() => useEditor.getState().apply((d) => moveFloor(d, active.id, 1))}
          disabled={index === floors.length - 1}
          title={index === floors.length - 1 ? 'Ya es la planta de arriba' : undefined}
        >
          <Icon name="up" size={16} />Subir
        </button>
        <button
          className="btn btn-chico"
          onClick={() => useEditor.getState().apply((d) => moveFloor(d, active.id, -1))}
          disabled={index === 0}
          title={index === 0 ? 'Ya es la planta de abajo' : undefined}
        >
          <Icon name="down" size={16} />Bajar
        </button>
      </div>
    </section>
  );
}
