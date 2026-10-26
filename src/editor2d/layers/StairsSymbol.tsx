import { add, normalize, perp, scale, sub } from '../../geometry/vec';
import type { Room, Vec2 } from '../../model/types';
import { stairDivider, stairPath, stairStepLines } from '../../walk/stairs';

const pts = (ps: Vec2[]) => ps.map((p) => `${p.x},${p.y}`).join(' ');

/** Plan symbol of a stairs room: step lines, the U divider and the walking line with an arrow towards the top. */
export default function StairsSymbol({ room, rise }: { room: Room; rise: number }) {
  const path = stairPath(room);
  const tip = path[path.length - 1];
  const dir = normalize(sub(tip, path[path.length - 2]));
  const head = 0.18;
  const back = sub(tip, scale(dir, head));
  const side = scale(perp(dir), head * 0.6);
  const divider = stairDivider(room);
  return (
    <g className="stairs-symbol">
      {stairStepLines(room, rise).map(([a, b], i) => (
        <line key={i} className="stair-step" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      ))}
      {divider && <line className="stair-divider" x1={divider[0].x} y1={divider[0].y} x2={divider[1].x} y2={divider[1].y} />}
      <polyline className="stair-arrow" points={pts(path)} />
      <polygon className="stair-arrow-head" points={pts([tip, add(back, side), sub(back, side)])} />
    </g>
  );
}
