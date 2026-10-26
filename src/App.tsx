import { lazy, Suspense, useEffect, useState } from 'react';
import Plan2D from './editor2d/Plan2D';
import { loadAutosave, startAutosave } from './persistence/autosave';
import { trackProjectLoads } from './persistence/currentFile';
import { useEditor } from './store/editorStore';
import FloorsPanel from './ui/FloorsPanel';
import PropertiesPanel from './ui/PropertiesPanel';
import Toolbar, { TOOLS } from './ui/Toolbar';
import { isEditableTarget } from './ui/keys';
import TopBar from './ui/TopBar';
import { useProjectFile } from './ui/useProjectFile';

const Scene3D = lazy(() => import('./view3d/Scene3D'));

type Layout = 'split' | '2d' | '3d';

export default function App() {
  const [layout, setLayout] = useState<Layout>('split');
  const { save, open } = useProjectFile();

  // Restore the last autosaved project, then keep autosaving.
  useEffect(() => trackProjectLoads(), []);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    void loadAutosave().then((p) => {
      if (cancelled) return;
      // Restored work only lives in the browser: keep it marked unsaved so Nuevo/Abrir ask first.
      if (p) useEditor.getState().loadProject(p, { dirty: true });
      stop = startAutosave();
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const s = useEditor.getState();
      const key = e.key.toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        if (key === 'z' && !e.shiftKey) s.undo();
        else if (key === 'y' || (key === 'z' && e.shiftKey)) s.redo();
        else if (key === 's') void save();
        else if (key === 'o') void open();
        else return;
        e.preventDefault();
        return;
      }
      if (e.key === 'Escape') { s.setTool('select'); s.select(null); return; }
      const t = TOOLS.find((x) => x.key.toLowerCase() === key);
      if (t && !e.altKey) s.setTool(t.tool);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save, open]);

  return (
    <div className="app">
      <TopBar />
      <Toolbar />
      <main className={`views layout-${layout}`}>
        {layout !== '3d' && (
          <section className="view view-2d">
            <Plan2D />
            <button className="maximise" onClick={() => setLayout(layout === '2d' ? 'split' : '2d')}>
              {layout === '2d' ? 'Dividir' : 'Ampliar 2D'}
            </button>
          </section>
        )}
        {layout !== '2d' && (
          <section className="view view-3d">
            <Suspense fallback={<div className="placeholder">Cargando 3D…</div>}>
              <Scene3D />
            </Suspense>
            <button className="maximise" onClick={() => setLayout(layout === '3d' ? 'split' : '3d')}>
              {layout === '3d' ? 'Dividir' : 'Ampliar 3D'}
            </button>
          </section>
        )}
      </main>
      <div className="sidebar">
        <FloorsPanel />
        <PropertiesPanel />
      </div>
    </div>
  );
}
