import { add, normalize, perp, scale, sub } from '../../geometry/vec';
import type { Floor, Opening, Wall } from '../../model/types';
import type { Selection } from '../../store/editorStore';

const pts = (ps: { x: number; y: number }[]) => ps.map((p) => `${p.x},${p.y}`).join(' ');

function OpeningSymbol({ wall, o, selected }: { wall: Wall; o: Opening; selected: boolean }) {
  const d = normalize(sub(wall.b, wall.a));
  const n = perp(d);
  const half = wall.thickness / 2 + 0.005;
  const start = add(wall.a, scale(d, o.offset - o.width / 2));
  const end = add(wall.a, scale(d, o.offset + o.width / 2));
  const gap = [add(start, scale(n, half)), add(end, scale(n, half)), sub(end, scale(n, half)), sub(start, scale(n, half))];
  const cls = `opening ${o.kind}${selected ? ' selected' : ''}`;
  if (o.kind === 'window') {
    const q = wall.thickness / 4;
    return (
      <g className={cls} data-id={o.id}>
        <polygon className="opening-gap" points={pts(gap)} />
        <polygon className="window-frame" points={pts(gap.map((p, i) => (i < 2 ? sub(p, scale(n, half - q)) : add(p, scale(n, half - q)))))} />
        <line className="window-glass" x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
      </g>
    );
  }
  // Door: leaf hinged at the start, opening towards +normal, with a 90° swing arc.
  const tip = add(add(start, scale(n, half)), scale(n, o.width));
  const hinge = add(start, scale(n, half));
  const closed = add(end, scale(n, half));
  return (
    <g className={cls} data-id={o.id}>
      <polygon className="opening-gap" points={pts(gap)} />
      <line className="door-leaf" x1={hinge.x} y1={hinge.y} x2={tip.x} y2={tip.y} />
      <path className="door-swing" d={`M ${closed.x} ${closed.y} A ${o.width} ${o.width} 0 0 1 ${tip.x} ${tip.y}`} />
    </g>
  );
}

export default function OpeningsLayer({ floor, selection }: { floor: Floor; selection: Selection }) {
  return (
    <g className="openings">
      {floor.openings.map((o) => {
        const wall = floor.walls.find((w) => w.id === o.wallId);
        if (!wall) return null;
        return <OpeningSymbol key={o.id} wall={wall} o={o} selected={selection?.kind === 'opening' && selection.id === o.id} />;
      })}
    </g>
  );
}
