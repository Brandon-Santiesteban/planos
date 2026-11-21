import { forwardRef } from 'react';
import type { Project } from '../../model/types';
import BackgroundLayer from '../layers/BackgroundLayer';
import DimensionsLayer from '../layers/DimensionsLayer';
import FurnitureLayer from '../layers/FurnitureLayer';
import OpeningsLayer from '../layers/OpeningsLayer';
import RoomsLayer from '../layers/RoomsLayer';
import SiteLayer from '../layers/SiteLayer';
import WallsLayer from '../layers/WallsLayer';
import Compass from '../Compass';
import type { Bounds } from '../viewport';
import { CAPTION, MARGIN, type PhotoOptions, photoLayout, scaleBarLength } from './planPhoto';

/** Metre grid over the framed area. */
function PhotoGrid({ b }: { b: Bounds }) {
  const pad = 1;
  const x0 = Math.floor(b.minX - pad);
  const x1 = Math.ceil(b.maxX + pad);
  const y0 = Math.floor(b.minY - pad);
  const y1 = Math.ceil(b.maxY + pad);
  const lines = [];
  for (let x = x0; x <= x1; x++) lines.push(<line key={`x${x}`} className="grid-major" x1={x} y1={y0} x2={x} y2={y1} />);
  for (let y = y0; y <= y1; y++) lines.push(<line key={`y${y}`} className="grid-major" x1={x0} y1={y} x2={x1} y2={y} />);
  return <g className="grid">{lines}</g>;
}

/** Caption band: project · floor on the left, scale bar and north arrow on the right. */
function Caption({ title, width, height, k, north }: { title: string; width: number; height: number; k: number; north: number }) {
  const top = height - CAPTION;
  const mid = top + CAPTION / 2;
  const metres = scaleBarLength(k);
  const len = metres * k;
  const compassX = width - MARGIN + 30 - 26;
  const barRight = compassX - 26 - 28;
  const barLeft = barRight - len;
  const half = len / 2;
  return (
    <g className="foto-pie">
      <line className="foto-pie-linea" x1={MARGIN / 2} y1={top} x2={width - MARGIN / 2} y2={top} />
      <text className="foto-pie-titulo" x={MARGIN / 2 + 4} y={mid} dominantBaseline="middle">{title}</text>
      <g className="foto-escala">
        <rect className="foto-escala-negro" x={barLeft} y={mid - 3} width={half} height={7} />
        <rect className="foto-escala-blanco" x={barLeft + half} y={mid - 3} width={half} height={7} />
        <text className="foto-escala-texto" x={barLeft} y={mid + 18} textAnchor="middle">0</text>
        <text className="foto-escala-texto" x={barRight} y={mid + 18} textAnchor="middle">{`${String(metres).replace('.', ',')} m`}</text>
      </g>
      <Compass north={north} x={compassX} y={mid + 6} />
    </g>
  );
}

/** The plan of one floor as a picture: only the drawing, light colours, framed to `bounds`. */
const PlanPhotoSvg = forwardRef<SVGSVGElement, { project: Project; floorIndex: number; bounds: Bounds; opts: PhotoOptions }>(
  function PlanPhotoSvg({ project, floorIndex, bounds, opts }, ref) {
    const floor = project.floors[floorIndex];
    const below = opts.below && floorIndex > 0 ? project.floors[floorIndex - 1] : null;
    const { width, height, k, transform } = photoLayout(bounds);
    return (
      <svg ref={ref} className="foto-plano-svg" xmlns="http://www.w3.org/2000/svg" width={width} height={height} data-floor={floor.id}>
        <rect x={0} y={0} width={width} height={height} fill="#FFFFFF" />
        <g transform={transform} data-mundo="" data-k={k}>
          {opts.background && <BackgroundLayer bg={floor.background} />}
          {opts.grid && <PhotoGrid b={bounds} />}
          {opts.site && <SiteLayer site={project.site} pxPerMetre={k} />}
          {below && <WallsLayer floor={below} ghost />}
          <RoomsLayer floor={floor} selection={null} pxPerMetre={k} part="shapes" />
          {opts.furniture && <FurnitureLayer floor={floor} selection={null} pxPerMetre={k} noGhost />}
          <WallsLayer floor={floor} />
          <OpeningsLayer floor={floor} selection={null} />
          {/* Labels last, with a white halo, so furniture and walls don't hide them. */}
          <RoomsLayer floor={floor} selection={null} pxPerMetre={k} showArea={opts.area} showNames={opts.names} part="labels" fitLabels />
          {opts.dimensions && <DimensionsLayer floor={floor} pxPerMetre={k} />}
        </g>
        <Caption title={`${project.name} · ${floor.name}`} width={width} height={height} k={k} north={project.north} />
      </svg>
    );
  },
);

export default PlanPhotoSvg;
