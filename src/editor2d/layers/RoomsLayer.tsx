import { polygonArea, polygonCentroid, rectangleSize } from '../../geometry/polygons';
import { formatArea, formatMetres } from '../../model/units';
import type { Floor } from '../../model/types';
import type { Selection } from '../../store/editorStore';
import { usePlanOptions } from '../planOptions';
import StairsSymbol from './StairsSymbol';

/** Area (when shown) and the inside size of rectangular rooms, e.g. «12,00 m² · 3,00 × 4,00 m». */
function areaLabel(points: { x: number; y: number }[], showArea: boolean): string {
  const r = rectangleSize(points);
  const size = r ? `${formatMetres(r.w).replace(' m', '')} × ${formatMetres(r.h)}` : '';
  const area = showArea ? formatArea(polygonArea(points)) : '';
  return [area, size].filter(Boolean).join(' · ');
}

/** Rough width of a label in the plan's sans-serif, as a multiple of its font size. */
const textWidth = (text: string, font: number) => text.length * 0.56 * font;

/**
 * Font size that fits the label across the room (down to 60 %), or null for an outdoor zone whose name doesn't fit
 * even then (narrow strips: setbacks, side passages).
 */
export function fittedFont(points: { x: number; y: number }[], kind: string, lines: string[], font: number): number | null {
  const xs = points.map((p) => p.x);
  const width = (Math.max(...xs) - Math.min(...xs)) * 0.95;
  const need = Math.max(...lines.map((l) => textWidth(l, font)));
  if (need <= width) return font;
  if (need * 0.6 <= width) return font * (width / need);
  return kind === 'exterior' ? null : font * 0.6;
}

/**
 * For the plan photo: `showArea` overrides the viewer's m² setting, `showNames: false` leaves the labels out,
 * `part` draws only the shapes or only the labels (so the labels can go on top of furniture and walls) and
 * `fitLabels` shrinks labels to their room and drops those of narrow outdoor strips.
 */
export default function RoomsLayer({ floor, selection, group, pxPerMetre, showArea: areaOverride, showNames = true, part = 'all', fitLabels = false }: {
  floor: Floor; selection: Selection; group?: Set<string>; pxPerMetre: number; showArea?: boolean; showNames?: boolean;
  part?: 'all' | 'shapes' | 'labels'; fitLabels?: boolean;
}) {
  const shapes = part !== 'labels';
  const labels = part !== 'shapes' && showNames;
  const font = 13 / pxPerMetre;
  const savedShowArea = usePlanOptions((s) => s.showArea);
  const showArea = areaOverride ?? savedShowArea;
  return (
    <g className="rooms">
      {floor.rooms.map((r) => {
        const c = polygonCentroid(r.points);
        const selected = (selection?.kind === 'room' && selection.id === r.id) || !!group?.has(r.id);
        return (
          <g key={r.id}>
            {shapes && (
              <polygon
                className={`room ${r.kind}${selected ? ' selected' : ''}`}
                points={r.points.map((p) => `${p.x},${p.y}`).join(' ')}
                data-id={r.id}
              />
            )}
            {shapes && r.kind === 'stairs' && <StairsSymbol room={r} rise={floor.height} />}
            {/* A roof is only outlined: its label would sit on top of the room underneath. */}
            {r.kind !== 'roof' && labels && (() => {
              const sub = areaLabel(r.points, showArea);
              const f = fitLabels ? fittedFont(r.points, r.kind, [r.name, sub], font) : font;
              if (f === null) return null;
              return (
                <>
                  <text className="room-name" x={c.x} y={c.y - f * 0.2} fontSize={f} textAnchor="middle">{r.name}</text>
                  <text className="room-area" x={c.x} y={c.y + f} fontSize={f * 0.85} textAnchor="middle">{sub}</text>
                </>
              );
            })()}
          </g>
        );
      })}
    </g>
  );
}
