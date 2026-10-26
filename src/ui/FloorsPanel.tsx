import { useState } from 'react';
import { addFloor, deleteFloor, moveFloor, renameFloor, setFloorHeight } from '../model/ops';
import { useEditor } from '../store/editorStore';
import { LengthField } from './fields';

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

  const remove = () => {
    if (!confirm(`¿Eliminar «${active.name}» y todo su contenido?`)) return;
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
    <section className="floors-panel">
      <h3>Plantas</h3>
      <ul>
        {[...floors].reverse().map((f) => (
          <li
            key={f.id}
            className={f.id === activeFloorId ? 'active' : ''}
            onClick={() => useEditor.getState().setActiveFloor(f.id)}
            onDoubleClick={() => setRenaming(f.id)}
            title="Doble clic para cambiar el nombre"
          >
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
        ))}
      </ul>
      <LengthField
        key={active.id}
        label={`Altura de ${active.name}`}
        value={active.height}
        onCommit={(v) => useEditor.getState().apply((d) => setFloorHeight(d, active.id, v!))}
      />
      <div className="floor-buttons">
        <button onClick={add}>Añadir planta</button>
        <button onClick={() => useEditor.getState().apply((d) => moveFloor(d, active.id, 1))} disabled={index === floors.length - 1}>Subir</button>
        <button onClick={() => useEditor.getState().apply((d) => moveFloor(d, active.id, -1))} disabled={index === 0}>Bajar</button>
        <button className="danger" onClick={remove} disabled={floors.length <= 1}>Eliminar</button>
      </div>
    </section>
  );
}
