import { createEmptyProject } from '../model/defaults';
import { useEditor } from '../store/editorStore';
import { getCurrentHandle, setCurrentHandle, trackProjectLoads } from './currentFile';

test('loading another project forgets the previous file handle', () => {
  const stop = trackProjectLoads();
  setCurrentHandle({ name: 'casa1.casa.json' } as FileSystemFileHandle);
  useEditor.getState().loadProject(createEmptyProject());
  expect(getCurrentHandle()).toBeUndefined();
  stop();
});

test('a handle set after loading is kept', () => {
  const stop = trackProjectLoads();
  useEditor.getState().loadProject(createEmptyProject());
  const h = { name: 'casa2.casa.json' } as FileSystemFileHandle;
  setCurrentHandle(h);
  expect(getCurrentHandle()).toBe(h);
  stop();
});
