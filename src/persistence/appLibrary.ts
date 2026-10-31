import type { Project } from '../model/types';
import { getCurrentHandle } from './currentFile';
import { createLibrary, idbKV } from './library';
import { saveProject } from './projectFile';
import { serverKV, syncedKV, uploadLocalProjects } from './serverKV';

const pc = serverKV();

/**
 * The app's projects library: saved on the PC running the app (biblioteca/), with a copy in this browser. On the
 * public site (a built copy, no PC behind it) only in the browser of whoever opens it.
 */
export const library = createLibrary(import.meta.env.DEV ? syncedKV(idbKV, pc) : idbKV);

/** Sends the projects this browser kept only for itself to the PC (once). Returns how many. */
export const uploadBrowserProjects = () => (import.meta.env.DEV ? uploadLocalProjects(idbKV, pc).catch(() => 0) : Promise.resolve(0));

/** Writes the project to the file it was opened from / saved to, if any. Returns the file name. */
export async function writeLinkedFile(p: Project): Promise<string | null> {
  const h = getCurrentHandle();
  if (!h) return null;
  await saveProject(p, h);
  return h.name;
}
