import { createEmptyProject } from '../model/defaults';
import { addOpening, addRoom, addWall } from '../model/ops';
import { parseProject, serializeProject } from './projectFile';

function sampleProject() {
  const p = createEmptyProject('Apartamento');
  const f = p.floors[0].id;
  const w = addWall(p, f, { x: 0, y: 0 }, { x: 4, y: 0 })!;
  addOpening(p, f, w, 'door', 2);
  addRoom(p, f, [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }], 'Sala');
  p.floors[0].background = {
    dataUrl: 'data:image/png;base64,AAAA', origin: { x: 0, y: 0 }, metresPerPixel: 0.01, opacity: 0.5, widthPx: 10, heightPx: 20,
  };
  return p;
}

test('round-trips a project', () => {
  const p = sampleProject();
  const r = parseProject(serializeProject(p));
  expect(r).toEqual({ ok: true, project: p });
});

test('files from before the compass open with north up', () => {
  const old = JSON.parse(serializeProject(sampleProject()));
  delete old.north;
  const r = parseProject(JSON.stringify(old));
  expect(r.ok && r.project.north).toBe(0);
});

test('rejects broken JSON', () => {
  const r = parseProject('{');
  expect(r.ok).toBe(false);
});

test('rejects unsupported version with a Spanish message', () => {
  const p = { ...sampleProject(), version: 2 };
  const r = parseProject(JSON.stringify(p));
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error).toMatch(/versión/i);
});

test('rejects an opening pointing to a missing wall', () => {
  const p = sampleProject();
  p.floors[0].openings[0].wallId = 'missing';
  expect(parseProject(serializeProject(p)).ok).toBe(false);
});

test('rejects an opening outside its wall', () => {
  const p = sampleProject();
  p.floors[0].openings[0].offset = 50;
  expect(parseProject(serializeProject(p)).ok).toBe(false);
});

test('rejects overlapping openings', () => {
  const p = sampleProject();
  p.floors[0].openings.push({ ...p.floors[0].openings[0], id: 'other' });
  expect(parseProject(serializeProject(p)).ok).toBe(false);
});

test('rejects a zero-length wall', () => {
  const p = sampleProject();
  p.floors[0].walls.push({ id: 'z', a: { x: 1, y: 1 }, b: { x: 1, y: 1 }, thickness: 0.15, height: null });
  expect(parseProject(serializeProject(p)).ok).toBe(false);
});

test('rejects an opening taller than its wall', () => {
  const p = sampleProject();
  p.floors[0].openings[0].height = 3;
  expect(parseProject(serializeProject(p)).ok).toBe(false);
});

test('error messages are fully in Spanish', () => {
  const r = parseProject('null');
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error).not.toMatch(/invalid|expected|received/i);
});

test('rejects a project without floors', () => {
  const p = { ...sampleProject(), floors: [] };
  expect(parseProject(JSON.stringify(p)).ok).toBe(false);
});

test('a roof keeps its own height', () => {
  const p = sampleProject();
  p.floors[0].rooms[0] = { ...p.floors[0].rooms[0], kind: 'roof', height: 3.1 };
  const r = parseProject(serializeProject(p));
  expect(r.ok && r.project.floors[0].rooms[0]).toMatchObject({ kind: 'roof', height: 3.1 });
});

test('furniture, finishes, stairs and railings survive a save/open', () => {
  const p = sampleProject();
  const f = p.floors[0];
  f.furniture = [{ id: 'm1', type: 'cama-doble', x: 1, y: 2, rotation: 90, width: 1.6, depth: 2, height: 0.5, elevation: 0 }];
  f.walls[0].sides = { left: { color: '#FFFFFF', finish: 'pintura' }, right: { finish: 'ladrillo' } };
  f.rooms[0] = { ...f.rooms[0], kind: 'stairs', up: 'e', floorMaterial: 'madera' };
  f.openings[0].flip = true;
  const r = parseProject(serializeProject(p));
  expect(r).toEqual({ ok: true, project: p });
});

test('files from before furniture existed open with no furniture', () => {
  const old = JSON.parse(serializeProject(sampleProject()));
  delete old.floors[0].furniture;
  const r = parseProject(JSON.stringify(old));
  expect(r.ok && r.project.floors[0].furniture).toEqual([]);
});

test('a U-shaped stairs keeps its shape', () => {
  const p = sampleProject();
  p.floors[0].rooms[0] = { ...p.floors[0].rooms[0], kind: 'stairs', up: 's', stairShape: 'u' };
  expect(parseProject(serializeProject(p))).toEqual({ ok: true, project: p });
  const bad = JSON.parse(serializeProject(p));
  bad.floors[0].rooms[0].stairShape = 'caracol';
  expect(parseProject(JSON.stringify(bad)).ok).toBe(false);
});
