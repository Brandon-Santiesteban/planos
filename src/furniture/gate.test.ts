import { createEmptyProject } from '../model/defaults';
import { addFurniture, furnitureFromCatalog, setGateOpen } from '../model/furnitureOps';
import { CATALOG } from './catalog';
import { gatePanels } from './gate';

test('the catalog has a two-leaf telescopic sliding gate, same height as the front fence', () => {
  const g = CATALOG.find((c) => c.id === 'porton-telescopico')!;
  expect(g.name).toBe('Portón corredizo telescópico');
  expect(g.height).toBeCloseTo(2.0);
});

test('closed, the two leaves cover the whole opening side by side', () => {
  const [a, b] = gatePanels(3.3, false);
  expect(a.x0).toBeCloseTo(-1.65);
  expect(b.x1).toBeCloseTo(1.65);
  expect(a.x1).toBeCloseTo(b.x0);
});

test('open, both leaves stack beyond the right end so the whole width is free', () => {
  const panels = gatePanels(3.3, true);
  for (const p of panels) expect(p.x0).toBeGreaterThanOrEqual(1.65 - 1e-9);
  // telescopic: the stacked leaves need only one leaf of space plus a small overlap
  expect(Math.max(...panels.map((p) => p.x1))).toBeLessThanOrEqual(1.65 + 1.65 + 0.1 + 1e-9);
  // and they sit on two parallel tracks
  expect(panels[0].track).not.toBe(panels[1].track);
});

test('opening and closing the gate is a project change', () => {
  const p = createEmptyProject();
  const f = p.floors[0].id;
  const id = addFurniture(p, f, furnitureFromCatalog('porton-telescopico', { x: 1.65, y: 10.2 }));
  setGateOpen(p, f, id, true);
  expect(p.floors[0].furniture[0].open).toBe(true);
  setGateOpen(p, f, id, false);
  expect(p.floors[0].furniture[0].open).toBe(false);
});
