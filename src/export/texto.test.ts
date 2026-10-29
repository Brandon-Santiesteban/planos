import { createEmptyProject } from '../model/defaults';
import { addOpening, addRectRoom } from '../model/ops';
import { setSite } from '../model/site';
import { exportText } from './texto';

test('the text lists the lot, each space with its inside size, what each door connects and the walls', () => {
  const p = createEmptyProject('Casa Capricho');
  const f = p.floors[0];
  addRectRoom(p, f.id, { x: 0, y: 0 }, 4, 3, 'Sala');
  addRectRoom(p, f.id, { x: 4.15, y: 0 }, 2, 3, 'Baño');
  const shared = f.walls.find((w) => Math.abs(w.a.x - 4.15) < 0.01 && Math.abs(w.b.x - 4.15) < 0.01)!;
  addOpening(p, f.id, shared.id, 'door', 1.5);
  setSite(p, { x: 0, y: -10, width: 7, depth: 14 });

  const t = exportText(p, p.floors);
  expect(t).toContain('# Casa Capricho');
  expect(t).toContain('Terreno: 7,00 de frente × 14,00 de fondo (98,00 m²)');
  expect(t).toContain('«Sala» · interior · 4,00 × 3,00 por dentro · 12,00 m²');
  expect(t).toMatch(/Puerta [\d,]+ × [\d,]+ entre «(Sala|Baño)» y «(Baño|Sala)»/);
  expect(t).toContain(`### Muros (${f.walls.length};`);
});
