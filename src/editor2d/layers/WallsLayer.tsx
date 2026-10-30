import { isEndConnected, wallFootprint } from '../../geometry/walls';
import type { Floor } from '../../model/types';
import type { Selection } from '../../store/editorStore';

const pts = (ps: { x: number; y: number }[]) => ps.map((p) => `${p.x},${p.y}`).join(' ');

export default function WallsLayer({ floor, selection, group, ghost = false }: { floor: Floor; selection?: Selection; group?: Set<string>; ghost?: boolean }) {
  return (
    <g className={ghost ? 'walls ghost' : 'walls'}>
      {floor.walls.map((w) => {
        const fp = wallFootprint(w, isEndConnected(floor.walls, w.id, 'a'), isEndConnected(floor.walls, w.id, 'b'));
        const selected = !ghost && ((selection?.kind === 'wall' && selection.id === w.id) || !!group?.has(w.id));
        return (
          <polygon
            key={w.id}
            className={`wall${w.kind === 'drywall' ? ' drywall' : ''}${ghost ? ' ghost' : ''}${selected ? ' selected' : ''}`}
            points={pts(fp)}
            data-id={w.id}
          />
        );
      })}
    </g>
  );
}
