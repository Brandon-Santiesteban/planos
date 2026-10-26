import type { Project } from '../model/types';
import { getCurrentHandle } from './currentFile';
import { createLibrary } from './library';
import { saveProject } from './projectFile';

/** The app's projects library, stored in this browser's IndexedDB. */
export const library = createLibrary();

/** Writes the project to the file it was opened from / saved to, if any. Returns the file name. */
export async function writeLinkedFile(p: Project): Promise<string | null> {
  const h = getCurrentHandle();
  if (!h) return null;
  await saveProject(p, h);
  return h.name;
}
