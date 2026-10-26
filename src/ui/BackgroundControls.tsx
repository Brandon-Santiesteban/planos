import { useRef, useState } from 'react';
import { loadBackgroundFile } from '../background/loadBackground';
import { setBackground, updateBackground } from '../model/ops';
import type { Floor } from '../model/types';
import { useEditor } from '../store/editorStore';

export default function BackgroundControls({ floor }: { floor: Floor }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const tool = useEditor((s) => s.tool);
  const bg = floor.background;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setLoading(true);
    try {
      const img = await loadBackgroundFile(file);
      const { apply, activeFloorId } = useEditor.getState();
      apply((d) => setBackground(d, activeFloorId, { ...img, origin: { x: 0, y: 0 }, metresPerPixel: 0.01, opacity: 0.5 }));
    } catch (e) {
      alert(`No se pudo cargar el plano: ${(e as Error).message}`);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const setTool = (t: 'calibrate' | 'moveBackground') => useEditor.getState().setTool(tool === t ? 'select' : t);

  return (
    <section className="bg-controls">
      <h3>Plano de fondo</h3>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,application/pdf" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <button onClick={() => fileRef.current?.click()} disabled={loading}>
        {loading ? 'Cargando…' : bg ? 'Cambiar plano de fondo' : 'Cargar plano de fondo'}
      </button>
      {bg && (
        <>
          <button className={tool === 'calibrate' ? 'active' : ''} onClick={() => setTool('calibrate')}>Calibrar escala</button>
          {tool === 'calibrate' && (
            <p className="hint">Haz clic en dos puntos del plano cuya distancia conozcas, escribe la medida real y pulsa Enter.</p>
          )}
          <button className={tool === 'moveBackground' ? 'active' : ''} onClick={() => setTool('moveBackground')}>Mover fondo</button>
          <div className="field">
            <label htmlFor="bg-opacity">Opacidad</label>
            <input
              id="bg-opacity"
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={bg.opacity}
              onPointerDown={() => useEditor.getState().checkpoint()}
              onChange={(e) => {
                const { apply, activeFloorId } = useEditor.getState();
                apply((d) => updateBackground(d, activeFloorId, { opacity: Number(e.target.value) }), { record: false });
              }}
            />
          </div>
          <button
            className="danger"
            onClick={() => {
              const { apply, activeFloorId } = useEditor.getState();
              apply((d) => setBackground(d, activeFloorId, null));
            }}
          >
            Quitar fondo
          </button>
        </>
      )}
    </section>
  );
}
