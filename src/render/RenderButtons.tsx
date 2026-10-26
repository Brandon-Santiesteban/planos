import { lazy, Suspense, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditor } from '../store/editorStore';
import Icon from '../ui/Icon';
import { notify } from '../ui/toasts';
import { photoFileName } from './fileName';
import { capturePhoto, downloadBlob } from './photo';
import { useRender } from './renderStore';

// The path tracer is heavy: load it only when the render window is opened.
const RenderWindow = lazy(() => import('./RenderWindow'));

/** "Tomar foto" and "Render" in the 3D overlay bar; also hosts the render window. */
export default function RenderButtons() {
  const ready = useRender((s) => s.ctx !== null);
  const open = useRender((s) => s.open);
  const [busy, setBusy] = useState(false);

  async function takePhoto() {
    const ctx = useRender.getState().ctx;
    if (!ctx || busy) return;
    setBusy(true);
    try {
      const { blob, width, height } = await capturePhoto(ctx.gl, ctx.scene, ctx.camera, 2);
      const name = photoFileName(useEditor.getState().project.name, new Date());
      downloadBlob(blob, name);
      notify({ kind: 'ok', text: `Foto guardada (${width} × ${height} px)` });
    } catch (e) {
      notify({ kind: 'error', text: 'No se pudo tomar la foto', detail: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="render-botones" role="group" aria-label="Fotos y render">
      <button type="button" className="btn btn-chico" disabled={!ready || busy} onClick={() => void takePhoto()} title="Guarda un PNG de esta vista al doble de resolución">
        <Icon name={busy ? 'redo' : 'camera'} size={16} className={busy ? 'girando' : undefined} />
        {busy ? 'Guardando…' : 'Tomar foto'}
      </button>
      <button type="button" className="btn btn-chico" disabled={!ready} onClick={() => useRender.getState().openWindow()} title="Imagen realista de esta vista con trazado de rayos">
        <Icon name="sparkle" size={16} />
        Render
      </button>
      {open && createPortal(<Suspense fallback={null}><RenderWindow /></Suspense>, document.body)}
    </div>
  );
}
