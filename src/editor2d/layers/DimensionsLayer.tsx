import { add, normalize, perp, scale, sub, lerp } from '../../geometry/vec';
import { wallLength } from '../../geometry/walls';
import { formatMetres } from '../../model/units';
import type { Floor } from '../../model/types';

/** Length label next to every wall, rotated along it and kept upright. */
export default function DimensionsLayer({ floor, pxPerMetre }: { floor: Floor; pxPerMetre: number }) {
  const font = 11 / pxPerMetre;
  return (
    <g className="dimensions">
      {floor.walls.map((w) => {
        const d = normalize(sub(w.b, w.a));
        const mid = lerp(w.a, w.b, 0.5);
        const at = add(mid, scale(perp(d), -(w.thickness / 2 + 10 / pxPerMetre)));
        let angle = (Math.atan2(d.y, d.x) * 180) / Math.PI;
        if (angle > 90 || angle < -90) angle += 180;
        return (
          <text
            key={w.id}
            className="dimension"
            x={at.x}
            y={at.y}
            fontSize={font}
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(${angle} ${at.x} ${at.y})`}
          >
            {formatMetres(wallLength(w))}
          </text>
        );
      })}
    </g>
  );
}
