import { polygonArea, polygonCentroid } from '../../geometry/polygons';
import { formatArea } from '../../model/units';
import type { Floor } from '../../model/types';
import type { Selection } from '../../store/editorStore';

export default function RoomsLayer({ floor, selection, pxPerMetre }: { floor: Floor; selection: Selection; pxPerMetre: number }) {
  const font = 13 / pxPerMetre;
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
            <text className="room-area" x={c.x} y={c.y + font} fontSize={font * 0.85} textAnchor="middle">{formatArea(polygonArea(r.points))}</text>
          </g>
        );
      })}
    </g>
  );
}
