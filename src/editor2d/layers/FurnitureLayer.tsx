import { catalogItem } from '../../furniture/catalog';
import { usePlacement } from '../../furniture/placeTool';
import { FurnitureSymbol } from '../../furniture/symbols';
import { byElevation } from '../../model/furnitureOps';
import type { Floor, Furniture } from '../../model/types';
import { useEditor, type Selection } from '../../store/editorStore';

/** Names are shown only where they fit: pieces at least this many pixels across. */
const LABEL_MIN_PX = 34;

function Piece({ f, selected, pxPerMetre, ghost = false }: { f: Furniture; selected: boolean; pxPerMetre: number; ghost?: boolean }) {
  const item = catalogItem(f.type);
  const font = 10 / pxPerMetre;
  const showName = ghost || selected || Math.min(f.width, f.depth) * pxPerMetre >= LABEL_MIN_PX;
  return (
    <g className={`mueble${selected ? ' selected' : ''}${ghost ? ' fantasma' : ''}${f.elevation > 0.05 ? ' elevado' : ''}`} data-id={ghost ? undefined : f.id}>
      <g transform={`translate(${f.x} ${f.y}) rotate(${f.rotation})`}>
        <FurnitureSymbol item={item} w={f.width} d={f.depth} />
      </g>
      {showName && (
        <text className="mueble-nombre" x={f.x} y={f.y} fontSize={font} textAnchor="middle" dominantBaseline="middle">
          {item?.name ?? f.type}
        </text>
      )}
    </g>
  );
}

/** Furniture as top-view outlines with symbols; lower pieces first so a monitor shows over its desk. */
export default function FurnitureLayer({ floor, selection, pxPerMetre }: { floor: Floor; selection: Selection; pxPerMetre: number }) {
  const tool = useEditor((s) => s.tool);
  const { itemId, ghost } = usePlacement();
  const item = itemId ? catalogItem(itemId) : undefined;
  return (
    <g className="muebles">
      {byElevation(floor.furniture ?? []).map((f) => (
        <Piece key={f.id} f={f} selected={selection?.kind === 'furniture' && selection.id === f.id} pxPerMetre={pxPerMetre} />
      ))}
      {tool === 'furniture' && item && ghost && (
        <Piece
          f={{ id: 'fantasma', type: item.id, ...ghost, width: item.width, depth: item.depth, height: item.height, elevation: 0 }}
          selected={false}
          pxPerMetre={pxPerMetre}
          ghost
        />
      )}
    </g>
  );
}
