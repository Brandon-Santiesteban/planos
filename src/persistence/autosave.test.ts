import { createEmptyProject } from '../model/defaults';
import { addWall } from '../model/ops';
import { useEditor } from '../store/editorStore';
import { startAutosave, useSaveStatus } from './autosave';
import { createLibrary, memoryKV } from './library';

const s = () => useEditor.getState();
const flush = () => vi.advanceTimersByTimeAsync(1100);

beforeEach(() => {
  vi.useFakeTimers();
  s().loadProject(createEmptyProject('Primero'));
});
afterEach(() => vi.useRealTimers());

test('edits are saved to the library 1 s later and the status says so', async () => {
  const lib = createLibrary(memoryKV());
  const stop = startAutosave({ lib });
  s().apply((d) => void addWall(d, d.floors[0].id, { x: 0, y: 0 }, { x: 4, y: 0 }));
  await flush();
  expect((await lib.load(s().project.id))!.floors[0].walls).toHaveLength(1);
  expect(useSaveStatus.getState().state).toBe('saved');
  stop();
});

test('starting a new project keeps the previous one', async () => {
  const lib = createLibrary(memoryKV());
  const stop = startAutosave({ lib });
  s().apply((d) => void addWall(d, d.floors[0].id, { x: 0, y: 0 }, { x: 4, y: 0 }));
  s().loadProject(createEmptyProject('Segundo')); // before the 1 s debounce
  s().apply((d) => void addWall(d, d.floors[0].id, { x: 0, y: 0 }, { x: 2, y: 0 }));
  await flush();
  const names = (await lib.list()).map((e) => e.name).sort();
  expect(names).toEqual(['Primero', 'Segundo']);
  stop();
});

test('loading a project marks it as the last one', async () => {
  const lib = createLibrary(memoryKV());
  const stop = startAutosave({ lib });
  const other = createEmptyProject('Otro');
  await lib.save(other);
  await lib.save(createEmptyProject('Tercero')); // now the last saved
  s().loadProject(other);
  await flush();
  expect((await lib.last())!.name).toBe('Otro');
  stop();
});

test('switching right after an edit still restores the newly opened project', async () => {
  const lib = createLibrary(memoryKV());
  const stop = startAutosave({ lib });
  const other = createEmptyProject('Otro');
  await lib.save(other);
  s().apply((d) => void addWall(d, d.floors[0].id, { x: 0, y: 0 }, { x: 4, y: 0 })); // pending edit of "Primero"
  s().loadProject(other);
  await flush();
  expect((await lib.last())!.name).toBe('Otro');
  expect((await lib.list()).map((e) => e.name).sort()).toEqual(['Otro', 'Primero']);
  stop();
});

test('when a file is linked it is written too and the project counts as saved', async () => {
  const lib = createLibrary(memoryKV());
  const writeFile = vi.fn(async () => 'casa.casa.json');
  const stop = startAutosave({ lib, writeFile });
  s().apply((d) => void addWall(d, d.floors[0].id, { x: 0, y: 0 }, { x: 4, y: 0 }));
  await flush();
  expect(writeFile).toHaveBeenCalledTimes(1);
  expect(s().dirty).toBe(false);
  expect(useSaveStatus.getState().file).toBe('casa.casa.json');
  stop();
});
