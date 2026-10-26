import { wallFootprint } from '../geometry/walls';
import { DEFAULTS } from '../model/defaults';
import { formatMetres } from '../model/units';
import type { ToolPreview } from './tools';

const pts = (ps: { x: number; y: number }[]) => ps.map((p) => `${p.x},${p.y}`).join(' ');

export default function PreviewLayer({ preview, pxPerMetre }: { preview: ToolPreview | null; pxPerMetre: number }) {
  if (!preview) return null;
  const r = 5 / pxPerMetre;
  if (preview.kind === 'marker') {
    const cls = preview.valid === false ? ' invalid' : '';
    const seg = preview.segment;
    return (
      <g className="preview">
        {seg && <line className={`preview-opening${cls}`} x1={seg[0].x} y1={seg[0].y} x2={seg[1].x} y2={seg[1].y} />}
        <circle className={`snap-marker${cls}`} cx={preview.at.x} cy={preview.at.y} r={r} />
      </g>
    );
  }
  if (preview.kind === 'quickRoom') {
    const font = 12 / pxPerMetre;
    const c = preview.interior;
    const cx = (c[0].x + c[2].x) / 2;
    const cy = (c[0].y + c[2].y) / 2;
    return (
      <g className="preview">
        {preview.corners.map((a, i) => {
          const b = preview.corners[(i + 1) % 4];
          const fp = wallFootprint({ id: 'q', a, b, thickness: preview.thickness, height: null }, true, true);
          return <polygon key={i} className="preview-wall" points={pts(fp)} />;
        })}
        <polygon className="preview-polygon" points={pts(c)} />
        <text className="preview-length" x={cx} y={cy} fontSize={font} textAnchor="middle" dominantBaseline="middle">
          {preview.label}
        </text>
      </g>
    );
  }
  if (preview.kind === 'polygon') {
    const all = [...preview.points, preview.cursor];
    return (
      <g className="preview">
        <polyline className="preview-polygon" points={pts(all)} />
        {preview.points.map((p, i) => <circle key={i} className="snap-marker" cx={p.x} cy={p.y} r={r} />)}
      </g>
    );
  }
  const fp = wallFootprint({ id: 'preview', a: preview.a, b: preview.b, thickness: DEFAULTS.wallThickness, height: null }, false, false);
  const font = 12 / pxPerMetre;
  return (
    <g className="preview">
      {preview.length > 1e-6 && <polygon className="preview-wall" points={pts(fp)} />}
      <circle className="snap-marker" cx={preview.a.x} cy={preview.a.y} r={r} />
      <circle className="snap-marker" cx={preview.b.x} cy={preview.b.y} r={r} />
      <text className="preview-length" x={preview.b.x + 10 / pxPerMetre} y={preview.b.y - 10 / pxPerMetre} fontSize={font}>
        {formatMetres(preview.length)}
      </text>
    </g>
  );
}
