import { useEditor, type Tool } from '../store/editorStore';

export const TOOLS: { tool: Tool; label: string; key: string; icon: string }[] = [
  { tool: 'select', label: 'Seleccionar', key: 'V', icon: '➤' },
  { tool: 'wall', label: 'Muro', key: 'M', icon: '▬' },
  { tool: 'door', label: 'Puerta', key: 'P', icon: '🚪' },
  { tool: 'window', label: 'Ventana', key: 'N', icon: '🪟' },
  { tool: 'room', label: 'Habitación', key: 'H', icon: '▢' },
];

export default function Toolbar() {
  const current = useEditor((s) => s.tool);
  return (
    <nav className="toolbar">
      {TOOLS.map((t) => (
        <button
          key={t.tool}
          className={current === t.tool ? 'active' : ''}
          data-testid={`tool-${t.tool}`}
          title={`${t.label} (${t.key})`}
          onClick={() => useEditor.getState().setTool(t.tool)}
        >
          <span className="icon">{t.icon}</span>
          <span className="label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
