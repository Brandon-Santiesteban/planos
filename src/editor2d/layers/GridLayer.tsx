import type { Size, View } from '../viewport';
import { screenToWorld } from '../viewport';

/** Metre grid (plus 10 cm grid when zoomed in) covering the visible area. */
export default function GridLayer({ view, size }: { view: View; size: Size }) {
  const tl = screenToWorld(view, size, { x: 0, y: 0 });
  const br = screenToWorld(view, size, { x: size.w, y: size.h });
  const lines: React.ReactElement[] = [];
  const addLines = (step: number, cls: string) => {
    for (let x = Math.floor(tl.x / step) * step; x <= br.x; x += step) {
      lines.push(<line key={`${cls}x${x.toFixed(2)}`} className={cls} x1={x} y1={tl.y} x2={x} y2={br.y} />);
    }
    for (let y = Math.floor(tl.y / step) * step; y <= br.y; y += step) {
      lines.push(<line key={`${cls}y${y.toFixed(2)}`} className={cls} x1={tl.x} y1={y} x2={br.x} y2={y} />);
    }
  };
  if (view.pxPerMetre >= 80) addLines(0.1, 'grid-minor');
  addLines(1, 'grid-major');
  return <g className="grid">{lines}</g>;
}
