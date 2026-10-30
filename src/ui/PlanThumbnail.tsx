import type { Project } from '../model/types';

/** Floor drawn in the preview: the one with the most rooms, which is usually the ground floor with the whole lot. */
function mainFloor(p: Project) {
  return p.floors.reduce((best, f) => (f.rooms.length + f.walls.length > best.rooms.length + best.walls.length ? f : best), p.floors[0]);
}

/** Small plan of a project (rooms and walls of its main floor) for the Mis proyectos gallery. */
export default function PlanThumbnail({ project }: { project: Project }) {
  const floor = mainFloor(project);
  const pts = [...floor.walls.flatMap((w) => [w.a, w.b]), ...floor.rooms.flatMap((r) => r.points)];
  if (!pts.length) return <div className="miniatura-vacia">Sin dibujo</div>;
  const xs = pts.map((q) => q.x);
  const ys = pts.map((q) => q.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pad = Math.max(maxX - minX, maxY - minY, 4) * 0.06;
  const box = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;
  return (
    <svg className="miniatura-plano" viewBox={box} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {floor.rooms.map((r) => (
        <polygon key={r.id} className={`mini-sala ${r.kind}`} points={r.points.map((q) => `${q.x},${q.y}`).join(' ')} />
      ))}
      {floor.walls.map((w) => (
        <line key={w.id} className="mini-muro" x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y} strokeWidth={Math.max(w.thickness, 0.12)} />
      ))}
    </svg>
  );
}
