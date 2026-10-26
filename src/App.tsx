import { lazy, Suspense, useEffect, useState } from 'react';
import GridControls from './editor2d/GridControls';
import Plan2D from './editor2d/Plan2D';
import { library, writeLinkedFile } from './persistence/appLibrary';
import { startAutosave } from './persistence/autosave';
import { fetchText, projectFromUrl } from './persistence/openFromUrl';
import { notify } from './ui/toasts';
import { trackProjectLoads } from './persistence/currentFile';
import { useEditor } from './store/editorStore';
import { DialogHost } from './ui/Dialog';
import FloorsPanel from './ui/FloorsPanel';
import Icon from './ui/Icon';
import ProjectsDialog, { openProjectsDialog } from './ui/ProjectsDialog';
import PropertiesPanel from './ui/PropertiesPanel';
import Toolbar, { TOOLS } from './ui/Toolbar';
import { isEditableTarget } from './ui/keys';
import { applyTheme, useTheme } from './ui/theme';
import ToastHost from './ui/ToastHost';
import TopBar from './ui/TopBar';
import { useProjectFile } from './ui/useProjectFile';

const Scene3D = lazy(() => import('./view3d/Scene3D'));

type Layout = 'split' | '2d' | '3d';

export default function App() {
  const [layout, setLayout] = useState<Layout>(() => (new URLSearchParams(location.search).get('vista') === '3d' ? '3d' : 'split'));
  const { save, open } = useProjectFile();
  const theme = useTheme((s) => s.theme);
  useEffect(() => applyTheme(theme), [theme]);

  // Restore the last autosaved project, then keep autosaving.
  useEffect(() => trackProjectLoads(), []);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const fromUrl = await projectFromUrl(location.search, fetchText, library);
      const p = fromUrl && 'project' in fromUrl ? fromUrl.project : await library.last().catch(() => null);
      if (cancelled) return;
      if (p) {
        useEditor.getState().loadProject(p);
        // Opened from a link: start on the top floor so the 3D view shows the whole house.
        if (fromUrl) useEditor.getState().setActiveFloor(p.floors[p.floors.length - 1].id);
      }
      if (fromUrl && 'error' in fromUrl) notify({ kind: 'error', text: fromUrl.error });
      if (fromUrl) history.replaceState(null, '', location.pathname); // a reload keeps your edits
      stop = startAutosave({ lib: library, writeFile: writeLinkedFile });
    })();
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
        else if (key === 'o') openProjectsDialog();
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
            <span className="etiqueta-vista">Plano 2D</span>
            <GridControls />
            <button className="maximise btn btn-chico" onClick={() => setLayout(layout === '2d' ? 'split' : '2d')}>
              <Icon name={layout === '2d' ? 'split' : 'maximize'} size={16} />{layout === '2d' ? 'Dividir' : 'Ampliar'}
            </button>
          </section>
        )}
        {layout !== '2d' && (
          <section className="view view-3d">
            <Suspense fallback={<div className="cargando"><div className="barra" /></div>}>
              <Scene3D />
            </Suspense>
            <span className="etiqueta-vista">Vista 3D</span>
            <button className="maximise btn btn-chico" onClick={() => setLayout(layout === '3d' ? 'split' : '3d')}>
              <Icon name={layout === '3d' ? 'split' : 'maximize'} size={16} />{layout === '3d' ? 'Dividir' : 'Ampliar'}
            </button>
          </section>
        )}
      </main>
      <div className="sidebar">
        <FloorsPanel />
        <PropertiesPanel />
      </div>
      <ToastHost />
      <ProjectsDialog onOpenFile={open} />
      <DialogHost />
    </div>
  );
}
