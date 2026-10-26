import { useRef, useState } from 'react';
import { loadBackgroundFile } from '../background/loadBackground';
import { setBackground, updateBackground } from '../model/ops';
import type { Floor } from '../model/types';
import { useEditor } from '../store/editorStore';
import Icon from './Icon';
import { notify } from './toasts';

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
      notify({ kind: 'ok', text: 'Plano cargado. Ahora calibra la escala.' });
    } catch (e) {
      notify({ kind: 'error', text: 'No se pudo cargar el plano', detail: (e as Error).message });
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const setTool = (t: 'calibrate' | 'moveBackground') => useEditor.getState().setTool(tool === t ? 'select' : t);

  return (
    <div className="bg-controls">
      <h3>Plano de fondo</h3>
      {!bg && <p className="hint parrafo">Carga una foto, imagen o PDF del plano de tu casa para dibujar encima.</p>}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,application/pdf" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <button className="btn btn-sec" onClick={() => fileRef.current?.click()} disabled={loading}>
        <Icon name={loading ? 'redo' : 'image'} size={16} className={loading ? 'girando' : undefined} />
        {loading ? 'Cargando…' : bg ? 'Cambiar plano de fondo' : 'Cargar plano de fondo'}
      </button>
      {bg && (
        <>
          <button className={`btn btn-sec${tool === 'calibrate' ? ' activo' : ''}`} onClick={() => setTool('calibrate')}>
            <Icon name="ruler" size={16} />Calibrar escala
          </button>
          {tool === 'calibrate' && (
            <p className="hint parrafo">Haz clic en dos puntos del plano cuya distancia conozcas, escribe la medida real y pulsa Enter.</p>
          )}
          <button className={`btn btn-sec${tool === 'moveBackground' ? ' activo' : ''}`} onClick={() => setTool('moveBackground')}>
            <Icon name="move" size={16} />Mover fondo
          </button>
          <div className="field" style={{ marginTop: 6 }}>
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
            className="btn btn-sec"
            onClick={() => {
              const { apply, activeFloorId } = useEditor.getState();
              apply((d) => setBackground(d, activeFloorId, null));
              notify({ kind: 'info', text: 'Plano de fondo quitado', action: { label: 'Deshacer', run: () => useEditor.getState().undo() } });
            }}
          >
            <Icon name="trash" size={16} />Quitar fondo
          </button>
        </>
      )}
    </div>
  );
}
