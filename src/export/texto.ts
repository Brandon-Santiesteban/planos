import { catalogItem } from '../furniture/catalog';
import { pointInPolygon, polygonArea } from '../geometry/polygons';
import { add, lerp, normalize, perp, scale, sub } from '../geometry/vec';
import { wallLength } from '../geometry/walls';
import { rectRoomSize } from '../model/ops';
import type { Floor, Project, Room, RoomKind, Vec2 } from '../model/types';

const KIND: Record<RoomKind, string> = { room: 'interior', balcony: 'abierto (patio o balcón)', roof: 'techo', stairs: 'escalera', exterior: 'terreno exterior' };
const UP: Record<string, string> = { n: 'hacia arriba del plano', s: 'hacia abajo del plano (la calle)', e: 'hacia la derecha', w: 'hacia la izquierda' };

/** Metres with a comma and 2 decimals, without the unit (the text says once that everything is in metres). */
const n = (v: number) => (Math.round(v * 100) / 100 + 0).toFixed(2).replace('.', ',');
const range = (vs: number[]) => `${n(Math.min(...vs))}–${n(Math.max(...vs))}`;

/** The room a point falls in: the smallest one that holds it (a bathroom inside a bedroom wins), never a roof. */
function roomAt(floor: Floor, q: Vec2): Room | undefined {
  return floor.rooms
    .filter((r) => r.kind !== 'roof' && pointInPolygon(q, r.points))
    .sort((a, b) => polygonArea(a.points) - polygonArea(b.points))[0];
}

function roomLine(r: Room): string {
  const size = rectRoomSize(r);
  const xs = r.points.map((q) => q.x);
  const ys = r.points.map((q) => q.y);
  const parts = [
    `«${r.name}»`,
    KIND[r.kind],
    size ? `${n(size.width)} × ${n(size.depth)} por dentro` : `${r.points.length} lados`,
    `${n(polygonArea(r.points))} m²`,
    `x ${range(xs)}, y ${range(ys)}`,
  ];
  if (r.floorMaterial) parts.push(`piso ${r.floorMaterial}`);
  if (r.kind === 'stairs') parts.push(`sube ${UP[r.up ?? 'n']}`);
  if (r.kind === 'roof' && r.height !== undefined) parts.push(`a ${n(r.height)} sobre el piso`);
  return `- ${parts.join(' · ')}`;
}

function floorText(floor: Floor): string[] {
  const out = [`## ${floor.name} (altura ${n(floor.height)} m)`, ''];
  const rooms = floor.rooms.filter((r) => r.kind !== 'exterior');
  const outside = floor.rooms.filter((r) => r.kind === 'exterior');
  out.push('### Espacios', ...(rooms.length ? rooms.map(roomLine) : ['- (ninguno)']), '');
  if (outside.length) out.push('### Terreno exterior (andén, calle, jardines)', ...outside.map(roomLine), '');

  if (floor.openings.length) {
    out.push('### Puertas y ventanas');
    for (const o of floor.openings) {
      const w = floor.walls.find((x) => x.id === o.wallId);
      if (!w) continue;
      const d = normalize(sub(w.b, w.a));
      const at = lerp(w.a, w.b, o.offset / wallLength(w));
      const side = (s: number) => roomAt(floor, add(at, scale(perp(d), s * (w.thickness / 2 + 0.1))))?.name ?? 'afuera';
      const what = o.kind === 'door' ? (o.glass ? 'Puerta de vidrio' : 'Puerta') : 'Ventana';
      const sizes = o.kind === 'door' ? `${n(o.width)} × ${n(o.height)}` : `${n(o.width)} × ${n(o.height)}, antepecho ${n(o.sill)}`;
      out.push(`- ${what} ${sizes} entre «${side(1)}» y «${side(-1)}» (centro en x ${n(at.x)}, y ${n(at.y)})`);
    }
    out.push('');
  }

  if (floor.furniture.length) {
    out.push('### Muebles');
    const byRoom = new Map<string, string[]>();
    for (const f of floor.furniture) {
      const where = roomAt(floor, f)?.name ?? 'afuera';
      const name = catalogItem(f.type)?.name ?? f.type;
      byRoom.set(where, [...(byRoom.get(where) ?? []), `${name} (${n(f.width)} × ${n(f.depth)})`]);
    }
    for (const [where, list] of byRoom) out.push(`- «${where}»: ${list.join(', ')}`);
    out.push('');
  }

  out.push(`### Muros (${floor.walls.length}; de punto a punto, eje del muro)`);
  for (const w of floor.walls) {
    const h = w.height === null ? '' : `, alto ${n(w.height)}`;
    out.push(`- (${n(w.a.x)}; ${n(w.a.y)}) → (${n(w.b.x)}; ${n(w.b.y)}), largo ${n(wallLength(w))}, grosor ${n(w.thickness)}${w.kind === 'drywall' ? ', drywall' : ''}${h}`);
  }
  out.push('');
  return out;
}

/** A plain description of the plan (spaces with their sizes, what connects to what, furniture, walls) to paste in a chat. */
export function exportText(project: Project, floors: Floor[]): string {
  const out = [
    `# ${project.name}`,
    '',
    'Medidas en metros. Coordenadas del plano: x hacia la derecha, y hacia abajo; la calle suele quedar abajo (y mayor).',
    `Pisos del proyecto: ${project.floors.map((f) => f.name).join(', ')}.`,
  ];
  const s = project.site;
  if (s) out.push(`Terreno: ${n(s.width)} de frente × ${n(s.depth)} de fondo (${n(s.width * s.depth)} m²), de x ${n(s.x)} a ${n(s.x + s.width)} y de y ${n(s.y)} a ${n(s.y + s.depth)}; el frente es el lado de y ${n(s.y + s.depth)}.`);
  out.push('');
  for (const f of floors) out.push(...floorText(f));
  return out.join('\n');
}
