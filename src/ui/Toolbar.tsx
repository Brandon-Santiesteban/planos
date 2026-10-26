import { useEditor, type Tool } from '../store/editorStore';
import Icon, { type IconName } from './Icon';

export const TOOLS: { tool: Tool; label: string; key: string; icon: IconName }[] = [
  { tool: 'select', label: 'Seleccionar', key: 'V', icon: 'select' },
  { tool: 'wall', label: 'Muro', key: 'M', icon: 'wall' },
  { tool: 'door', label: 'Puerta', key: 'P', icon: 'door' },
  { tool: 'window', label: 'Ventana', key: 'N', icon: 'window' },
  { tool: 'room', label: 'Habitación', key: 'H', icon: 'room' },
];

export default function Toolbar() {
  const current = useEditor((s) => s.tool);
  return (
    <nav className="toolbar" aria-label="Herramientas">
      {TOOLS.map((t) => (
        <button
          key={t.tool}
          className={`herramienta${current === t.tool ? ' activa' : ''}`}
          data-testid={`tool-${t.tool}`}
          title={`${t.label} (${t.key})`}
          aria-pressed={current === t.tool}
          onClick={() => useEditor.getState().setTool(t.tool)}
        >
          <Icon name={t.icon} size={18} />
          <span>{t.label}</span>
          <span className="tecla">{t.key}</span>
        </button>
      ))}
    </nav>
  );
}
