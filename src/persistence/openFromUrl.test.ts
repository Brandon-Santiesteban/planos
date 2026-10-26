import { createEmptyProject } from '../model/defaults';
import { addWall } from '../model/ops';
import { createLibrary, memoryKV } from './library';
import { projectFromUrl } from './openFromUrl';
import { serializeProject } from './projectFile';

const example = createEmptyProject('Casa etapa 1');
// Plain function (a rejecting vi.fn is reported as an unhandled rejection).
const calls: string[] = [];
async function fetchText(path: string): Promise<string> {
  calls.push(path);
  if (path === '/ejemplos/casa.casa.json') return serializeProject(example);
  throw new Error('404');
}

beforeEach(() => {
  calls.length = 0;
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

test('if the example was already opened, your saved copy (with your changes) is used', async () => {
  const lib = createLibrary(memoryKV());
  const edited = structuredClone(example);
  addWall(edited, edited.floors[0].id, { x: 0, y: 0 }, { x: 4, y: 0 });
  await lib.save(edited);
  const r = await projectFromUrl('?abrir=ejemplos/casa.casa.json', fetchText, lib);
  expect(r && 'project' in r && r.project.floors[0].walls).toHaveLength(1);
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
