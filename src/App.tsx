import { useEffect, useState } from 'react';
import Plan2D from './editor2d/Plan2D';
import { useEditor } from './store/editorStore';
import FloorsPanel from './ui/FloorsPanel';
import PropertiesPanel from './ui/PropertiesPanel';
import Toolbar, { TOOLS } from './ui/Toolbar';
import TopBar from './ui/TopBar';
import { useProjectFile } from './ui/useProjectFile';

type Layout = 'split' | '2d' | '3d';

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}

export default function App() {
  const [layout, setLayout] = useState<Layout>('split');
  const { save, open } = useProjectFile();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
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
          <section className="view view-3d" data-testid="scene3d-slot">
            <div className="placeholder">Vista 3D</div>
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
