import { polygonArea, polygonCentroid, rectangleSize } from '../../geometry/polygons';
import { formatArea, formatMetres } from '../../model/units';
import type { Floor } from '../../model/types';
import type { Selection } from '../../store/editorStore';
import { usePlanOptions } from '../planOptions';

/** Area (when shown) and the inside size of rectangular rooms, e.g. «12,00 m² · 3,00 × 4,00 m». */
function areaLabel(points: { x: number; y: number }[], showArea: boolean): string {
  const r = rectangleSize(points);
  const size = r ? `${formatMetres(r.w).replace(' m', '')} × ${formatMetres(r.h)}` : '';
  const area = showArea ? formatArea(polygonArea(points)) : '';
  return [area, size].filter(Boolean).join(' · ');
}

export default function RoomsLayer({ floor, selection, pxPerMetre }: { floor: Floor; selection: Selection; pxPerMetre: number }) {
  const font = 13 / pxPerMetre;
  const showArea = usePlanOptions((s) => s.showArea);
  return (
    <g className="rooms">
      {floor.rooms.map((r) => {
        const c = polygonCentroid(r.points);
        const selected = selection?.kind === 'room' && selection.id === r.id;
        return (
          <g key={r.id}>
            <polygon
              className={`room ${r.kind}${selected ? ' selected' : ''}`}
              points={r.points.map((p) => `${p.x},${p.y}`).join(' ')}
              data-id={r.id}
            />
            <text className="room-name" x={c.x} y={c.y - font * 0.2} fontSize={font} textAnchor="middle">{r.name}</text>
            <text className="room-area" x={c.x} y={c.y + font} fontSize={font * 0.85} textAnchor="middle">{areaLabel(r.points, showArea)}</text>
          </g>
        );
      })}
    </g>
  );
}
