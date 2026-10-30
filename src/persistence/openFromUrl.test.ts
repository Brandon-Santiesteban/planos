import { createEmptyProject } from '../model/defaults';
import { addWall } from '../model/ops';
import { createLibrary, memoryKV } from './library';
import { linkFor, linkedFile, projectFromUrl } from './openFromUrl';
import { serializeProject } from './projectFile';

let example = createEmptyProject('Casa etapa 1');
// Plain function (a rejecting vi.fn is reported as an unhandled rejection).
const calls: string[] = [];
async function fetchText(path: string): Promise<string> {
  calls.push(path);
  if (path === '/ejemplos/casa.casa.json') return serializeProject(example);
  throw new Error('404');
}

beforeEach(() => {
  calls.length = 0;
  example = createEmptyProject('Casa etapa 1');
});

test('without ?abrir nothing is loaded', async () => {
  expect(await projectFromUrl('', fetchText, createLibrary(memoryKV()))).toBeNull();
  expect(calls).toEqual([]);
});

test('?abrir loads the example file', async () => {
  const r = await projectFromUrl('?abrir=ejemplos/casa.casa.json', fetchText, createLibrary(memoryKV()));
  expect(r).toMatchObject({ project: { name: 'Casa etapa 1' } });
  expect(calls).toEqual(['/ejemplos/casa.casa.json']);
});

test('?p= is the short link for a file in ejemplos', async () => {
  expect(linkedFile('?p=casa')).toBe('ejemplos/casa.casa.json');
  expect(linkFor('ejemplos/casa.casa.json')).toBe('?p=casa');
  const r = await projectFromUrl('?p=casa&vista=3d', fetchText, createLibrary(memoryKV()));
  expect(r).toMatchObject({ project: { name: 'Casa etapa 1' }, file: 'ejemplos/casa.casa.json' });
});

test('while the file does not change, your saved copy (with your changes) is used', async () => {
  const lib = createLibrary(memoryKV());
  await projectFromUrl('?p=casa', fetchText, lib);
  const edited = structuredClone(example);
  addWall(edited, edited.floors[0].id, { x: 0, y: 0 }, { x: 4, y: 0 });
  await lib.save(edited);
  const r = await projectFromUrl('?p=casa', fetchText, lib);
  expect(r && 'project' in r && r.project.floors[0].walls).toHaveLength(1);
});

test('when the file changes, a reload shows the new version', async () => {
  const lib = createLibrary(memoryKV());
  await projectFromUrl('?p=casa', fetchText, lib);
  addWall(example, example.floors[0].id, { x: 0, y: 0 }, { x: 4, y: 0 });
  const r = await projectFromUrl('?p=casa', fetchText, lib);
  expect(r && 'project' in r && r.project.floors[0].walls).toHaveLength(1);
  expect(r).not.toHaveProperty('notice', expect.any(String));
  expect(await lib.list()).toHaveLength(1);
});

test('when the file changes and you had edited it, your version is kept as a copy', async () => {
  const lib = createLibrary(memoryKV());
  await projectFromUrl('?p=casa', fetchText, lib);
  const edited = structuredClone(example);
  addWall(edited, edited.floors[0].id, { x: 0, y: 0 }, { x: 1, y: 0 });
  await lib.save(edited);
  example.name = 'Casa etapa 1 v2';
  const r = await projectFromUrl('?p=casa', fetchText, lib);
  expect(r).toMatchObject({ project: { name: 'Casa etapa 1 v2' }, notice: 'Tus cambios quedaron guardados en «Casa etapa 1 (mis cambios)»' });
  const names = (await lib.list()).map((e) => e.name).sort();
  expect(names).toEqual(['Casa etapa 1 (mis cambios)', 'Casa etapa 1 v2']);
});

test('a missing or broken file gives a Spanish error', async () => {
  const r = await projectFromUrl('?abrir=ejemplos/no-existe.json', fetchText, createLibrary(memoryKV()));
  expect(r).toEqual({ error: 'No se pudo abrir «ejemplos/no-existe.json»' });
});

test('paths outside the app are refused', async () => {
  const r = await projectFromUrl('?abrir=https://otro-sitio.com/x.json', fetchText, createLibrary(memoryKV()));
  expect(r).toEqual({ error: 'No se pudo abrir «https://otro-sitio.com/x.json»' });
  expect(calls).toEqual([]);
});

test('a copy saved before links followed their file is kept the first time', async () => {
  const lib = createLibrary(memoryKV());
  const edited = structuredClone(example);
  addWall(edited, edited.floors[0].id, { x: 0, y: 0 }, { x: 4, y: 0 });
  await lib.save(edited);
  const r = await projectFromUrl('?p=casa', fetchText, lib);
  expect(r && 'project' in r && r.project.floors[0].walls).toHaveLength(1);
  expect(await lib.origin(example.id)).toMatchObject({ file: 'ejemplos/casa.casa.json' });
});
