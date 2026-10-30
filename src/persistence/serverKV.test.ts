import { createEmptyProject } from '../model/defaults';
import { createLibrary, type KV, memoryKV } from './library';
import { syncedKV, uploadLocalProjects } from './serverKV';

const down: KV = {
  get: () => Promise.reject(new Error('sin red')),
  set: () => Promise.reject(new Error('sin red')),
  del: () => Promise.reject(new Error('sin red')),
};

test('a project saved through one browser is found by another (different link, same PC)', async () => {
  const pc = memoryKV();
  const a = createLibrary(syncedKV(memoryKV(), pc));
  const b = createLibrary(syncedKV(memoryKV(), pc));
  const p = createEmptyProject('Casa Capricho');
  await a.save(p);
  expect((await b.list()).map((e) => e.name)).toEqual(['Casa Capricho']);
  expect((await b.load(p.id))?.name).toBe('Casa Capricho');
});

test('if the PC cannot be reached the browser copy is used, and the save reports the failure', async () => {
  const local = memoryKV();
  const p = createEmptyProject('Casa');
  await createLibrary(local).save(p);
  const lib = createLibrary(syncedKV(local, down));
  expect((await lib.load(p.id))?.name).toBe('Casa');
  await expect(lib.save(p)).rejects.toThrow();
});

test('projects kept only in a browser are uploaded to the PC once', async () => {
  const local = memoryKV();
  const pc = memoryKV();
  const old = createEmptyProject('Croquis de ayer');
  await createLibrary(local).save(old);
  const already = createEmptyProject('En el PC');
  await createLibrary(pc).save(already);
  expect(await uploadLocalProjects(local, pc)).toBe(1);
  expect((await createLibrary(pc).list()).map((e) => e.name).sort()).toEqual(['Croquis de ayer', 'En el PC']);
  expect(await uploadLocalProjects(local, pc)).toBe(0);
});

test('the project each computer had open stays its own', async () => {
  const pc = memoryKV();
  const a = createLibrary(syncedKV(memoryKV(), pc));
  const b = createLibrary(syncedKV(memoryKV(), pc));
  const one = createEmptyProject('Uno');
  const two = createEmptyProject('Dos');
  await a.save(one);
  await b.save(two);
  expect((await a.last())?.name).toBe('Uno');
  expect((await b.last())?.name).toBe('Dos');
});
