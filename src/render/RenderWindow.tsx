import { useEffect, useMemo, useRef, useState } from 'react';
import { Vector2 } from 'three';
import { useEditor } from '../store/editorStore';
import Icon from '../ui/Icon';
import SegmentedSwitch from '../ui/SegmentedSwitch';
import { notify } from '../ui/toasts';
import { photoFileName } from './fileName';
import { canPathTrace, RealisticRender } from './pathTracer';
import { downloadBlob, maxRenderSide } from './photo';
import { RENDER_PRESETS, type RenderPreset, renderSize } from './presets';
import { describeProgress } from './progress';
import { useRender } from './renderStore';

type Status = 'preparando' | 'renderizando' | 'detenido' | 'terminado' | 'error';

const PRESET_OPTIONS = (Object.keys(RENDER_PRESETS) as RenderPreset[]).map((value) => ({ value, label: RENDER_PRESETS[value].label }));

/** "Render realista": progressive path tracing of the current camera view. */
export default function RenderWindow() {
  const ctx = useRender((s) => s.ctx);
  const preset = useRender((s) => s.preset);
  const holderRef = useRef<HTMLDivElement>(null);
  const jobRef = useRef<RealisticRender | null>(null);
  const runningRef = useRef(false);
  const [status, setStatus] = useState<Status>('preparando');
  const [error, setError] = useState('');
  const [prog, setProg] = useState({ samples: 0, elapsed: 0, compiling: true });

  const size = useMemo(() => {
    if (!ctx) return null;
    const buf = ctx.gl.getDrawingBufferSize(new Vector2());
    return renderSize(buf.x, buf.y, preset, maxRenderSide(ctx.gl));
  }, [ctx, preset]);
  const target = RENDER_PRESETS[preset].samples;

  useEffect(() => {
    const holder = holderRef.current;
    if (!ctx || !size || !holder) return;
    // A fresh canvas per run: a WebGL context that was released can't be created again on the same element.
    const canvas = document.createElement('canvas');
    canvas.className = 'render-lienzo';
    canvas.dataset.testid = 'render-lienzo';
    holder.replaceChildren(canvas);
    setStatus('preparando');
    setError('');
    setProg({ samples: 0, elapsed: 0, compiling: true });
    if (!canPathTrace(ctx.gl)) {
      fail('Tu navegador o tarjeta gráfica no permite el render realista (falta WebGL 2 con texturas de coma flotante).');
      return;
    }

    let cancelled = false;
    let raf = 0;
    let elapsed = 0;
    let last = 0;
    let job: RealisticRender;
    try {
      job = new RealisticRender(canvas, ctx, size.width, size.height, preset);
    } catch (e) {
      fail((e as Error).message);
      return;
    }
    jobRef.current = job;

    // The driver may reset the GPU when a sample takes too long (weak or busy graphics cards).
    const onLost = () => {
      if (!cancelled) fail('La tarjeta gráfica se reinició durante el render. Prueba con la calidad «Rápido» o cierra otras pestañas con 3D.');
    };
    canvas.addEventListener('webglcontextlost', onLost);

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      if (!runningRef.current) {
        last = now;
        return;
      }
      elapsed += now - last;
      last = now;
      job.step();
      const samples = job.samples;
      setProg({ samples, elapsed, compiling: job.compiling });
      if (samples >= job.target) {
        runningRef.current = false;
        setStatus('terminado');
        notify({ kind: 'ok', text: `Render terminado en ${describeProgress(samples, job.target, elapsed).timeText}` });
      }
    };

    job
      .prepare()
      .then(() => {
        if (cancelled) return;
        runningRef.current = true;
        setStatus('renderizando');
        last = performance.now();
        tick();
      })
      .catch((e: Error) => !cancelled && fail(e.message));

    function fail(detail: string) {
      runningRef.current = false;
      setStatus('error');
      setError(detail);
      notify({ kind: 'error', text: 'No se pudo hacer el render', detail });
    }

    return () => {
      cancelled = true;
      canvas.removeEventListener('webglcontextlost', onLost);
      runningRef.current = false;
      cancelAnimationFrame(raf);
      jobRef.current = null;
      job.dispose();
      canvas.remove();
    };
  }, [ctx, size, preset]);

  const close = () => useRender.getState().closeWindow();
  const canSave = prog.samples >= 1 && status !== 'error' && status !== 'preparando';

  function stop() {
    runningRef.current = false;
    setStatus('detenido');
    notify({ kind: 'info', text: `Render detenido en ${Math.floor(prog.samples)} muestras` });
  }

  function resume() {
    runningRef.current = true;
    setStatus('renderizando');
  }

  async function save() {
    const job = jobRef.current;
    if (!job || !canSave) return;
    try {
      const blob = await job.toBlob();
      downloadBlob(blob, photoFileName(`${useEditor.getState().project.name} render`, new Date()));
      notify({ kind: 'ok', text: 'Imagen guardada' });
    } catch (e) {
      notify({ kind: 'error', text: 'No se pudo guardar la imagen', detail: (e as Error).message });
    }
  }

  // Esc closes, Enter saves (the main action).
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'Enter' && (e.target as HTMLElement | null)?.tagName !== 'BUTTON') void saveRef.current();
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const p = describeProgress(prog.samples, target, prog.elapsed);
  const working = status === 'preparando' || status === 'renderizando';
  const preparing = status === 'preparando' || (status === 'renderizando' && prog.samples < 1);

  return (
    <>
      <div className="velo" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
        <div className="ventana render-ventana" role="dialog" aria-modal="true" aria-labelledby="render-titulo">
          <div className="render-cabecera">
            <h2 id="render-titulo">Render realista</h2>
            <SegmentedSwitch<RenderPreset> label="Calidad" value={preset} options={PRESET_OPTIONS} onChange={(v) => useRender.getState().setPreset(v)} />
          </div>
          <p className="parrafo">Luz, sombras y reflejos calculados con trazado de rayos sobre esta misma vista. Cuantas más muestras, menos grano.</p>
          <div ref={holderRef} className="render-marco" style={size ? { aspectRatio: `${size.width} / ${size.height}` } : undefined} />
          <div className="render-datos">
            {size && <span>{size.width} × {size.height} px</span>}
            <span>{status === 'terminado' ? `${target} muestras · ${p.timeText}` : p.samplesText}</span>
            {status === 'error' && <span className="render-error">{error}</span>}
          </div>
          <div className="ventana-botones">
            <button className="btn btn-sec" onClick={close}>Cerrar</button>
            {status === 'detenido' ? (
              <button className="btn btn-sec" onClick={resume}>
                <Icon name="play" size={16} />
                Seguir
              </button>
            ) : (
              <button className="btn btn-sec" onClick={stop} disabled={!working || preparing} title={preparing ? 'Espera a que empiece el render' : undefined}>
                <Icon name="stop" size={16} />
                Detener
              </button>
            )}
            <button className="btn btn-pri" onClick={() => void save()} disabled={!canSave} title={canSave ? undefined : 'Espera la primera muestra'}>
              <Icon name="download" size={16} />
              Guardar imagen
            </button>
          </div>
        </div>
      </div>
      {working && (
        <div className="aviso-progreso" role="status" aria-live="polite" data-testid="render-progreso">
          <div className="aviso-progreso-linea">
            <Icon name="redo" size={16} className="girando" />
            <span className="aviso-progreso-titulo">{preparing ? 'Preparando la escena…' : 'Renderizando…'}</span>
            <span className="aviso-progreso-cifra">{p.samplesText}</span>
          </div>
          <div className="aviso-progreso-barra"><div style={{ width: `${(p.fraction * 100).toFixed(1)}%` }} /></div>
          <div className="aviso-progreso-pie">
            <span>{p.timeText}</span>
            <span>{preparing ? (prog.compiling ? 'Compilando sombreadores' : 'Calculando…') : p.remainingText}</span>
          </div>
        </div>
      )}
    </>
  );
}
