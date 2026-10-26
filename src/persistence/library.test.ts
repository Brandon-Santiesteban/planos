import { createEmptyProject } from '../model/defaults';
import { addWall } from '../model/ops';
import { createLibrary, memoryKV } from './library';

let clock = 1000;
const now = () => clock;
beforeEach(() => {
  clock = 1000;
});

test('saved projects are listed newest first', async () => {
  const lib = createLibrary(memoryKV(), now);
  const a = createEmptyProject('Apartamento');
  const b = createEmptyProject('Casa campo');
  await lib.save(a);
  clock = 2000;
  await lib.save(b);
  const list = await lib.list();
  expect(list.map((e) => e.name)).toEqual(['Casa campo', 'Apartamento']);
  expect(list[0]).toMatchObject({ id: b.id, updatedAt: 2000, floors: 1 });
});

test('saving the same project again updates it instead of duplicating', async () => {
  const lib = createLibrary(memoryKV(), now);
  const p = createEmptyProject('Apartamento');
  await lib.save(p);
  addWall(p, p.floors[0].id, { x: 0, y: 0 }, { x: 4, y: 0 });
  clock = 5000;
  await lib.save(p);
  expect(await lib.list()).toHaveLength(1);
  expect((await lib.load(p.id))!.floors[0].walls).toHaveLength(1);
});

test('remove deletes a project', async () => {
  const lib = createLibrary(memoryKV(), now);
  const p = createEmptyProject();
  await lib.save(p);
  await lib.remove(p.id);
  expect(await lib.list()).toEqual([]);
  expect(await lib.load(p.id)).toBeNull();
});

test('last() returns the last saved project', async () => {
  const lib = createLibrary(memoryKV(), now);
  const a = createEmptyProject('A');
  const b = createEmptyProject('B');
  await lib.save(a);
  await lib.save(b);
  expect((await lib.last())!.name).toBe('B');
});

test('opening a project makes it the one restored next time', async () => {
  const lib = createLibrary(memoryKV(), now);
  const a = createEmptyProject('A');
  const b = createEmptyProject('B');
  await lib.save(a);
  await lib.save(b);
  await lib.setLast(a.id);
  expect((await lib.last())!.name).toBe('A');
});

test('if the last project is gone, the newest one is restored', async () => {
  const lib = createLibrary(memoryKV(), now);
  const a = createEmptyProject('A');
  await lib.save(a);
  await lib.setLast('never-saved');
  expect((await lib.last())!.name).toBe('A');
});

test('the old single autosave slot is imported', async () => {
  const kv = memoryKV();
  const old = createEmptyProject('Antiguo') as { id?: string };
  delete old.id;
  await kv.set('autosave', JSON.stringify(old));
  const lib = createLibrary(kv, now);
  const p = await lib.last();
  expect(p!.name).toBe('Antiguo');
  expect(p!.id).toBeTruthy();
  expect((await lib.list()).map((e) => e.name)).toEqual(['Antiguo']);
});
