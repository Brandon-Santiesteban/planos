import type { Site } from '../../model/types';
import { formatMetres } from '../../model/units';

/** The lot as a dashed outline with its size written along the front and one side. */
export default function SiteLayer({ site, pxPerMetre }: { site: Site | undefined; pxPerMetre: number }) {
  if (!site) return null;
  const { x, y, width, depth } = site;
  const font = 12 / pxPerMetre;
  const gap = 18 / pxPerMetre;
  return (
    <g className="terreno-plano">
      <rect className="terreno-borde" x={x} y={y} width={width} height={depth} />
      <text className="terreno-cota" x={x + width / 2} y={y + depth + gap} fontSize={font} textAnchor="middle" dominantBaseline="middle">
        {`Terreno ${formatMetres(width)} (frente)`}
      </text>
      <text
        className="terreno-cota"
        x={x - gap}
        y={y + depth / 2}
        fontSize={font}
        textAnchor="middle"
        dominantBaseline="middle"
        transform={`rotate(-90 ${x - gap} ${y + depth / 2})`}
      >
        {`Fondo ${formatMetres(depth)}`}
      </text>
    </g>
  );
}
