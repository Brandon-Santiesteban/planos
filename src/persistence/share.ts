import { useEditor } from '../store/editorStore';
import { library } from './appLibrary';
import { pauseLiveCheck, useLinkedOrigin } from './liveLink';
import { hashProject, hashText, linkFor } from './openFromUrl';
import { serializeProject } from './projectFile';

/** Address of the public site that shows the shared projects (set in .env as VITE_SITIO_PUBLICO). */
export const PUBLIC_SITE = (import.meta.env.VITE_SITIO_PUBLICO as string | undefined)?.replace(/\/$/, '') || null;

/** Sharing writes files and publishes them: only the app running on the PC (dev server) can do it. */
export const canShare = import.meta.env.DEV;

/** The fixed link of a project file on the public site (or on this address while there is no public site). */
export const publicLink = (file: string) => `${(PUBLIC_SITE ?? `${location.origin}${location.pathname}`).replace(/\/$/, '')}/${linkFor(file)}`;

/**
 * «Compartir»: publishes the project as it is now (with your own changes) under its fixed link. The project keeps
 * its id and becomes a project of the app; sharing again updates what the link shows.
 */
export async function shareProject(id: string): Promise<{ file: string; link: string; published: boolean; error?: string }> {
  const editor = useEditor.getState();
  const project = editor.project.id === id ? editor.project : await library.load(id);
  if (!project) throw new Error('No se encontró el proyecto');
  await library.save(project);
  const origin = await library.origin(id);
  pauseLiveCheck(15_000);
  const res = await fetch('/api/compartir', { method: 'POST', body: JSON.stringify({ file: origin?.file, text: serializeProject(project) }) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const r = (await res.json()) as { file: string; published: boolean; error?: string };
  // What the file holds now is this very project: it counts as unedited from here on.
  const written = await fetch(`/${r.file}`, { cache: 'no-store' }).then((x) => x.text());
  const next = { file: r.file, fileHash: hashText(written), projectHash: hashProject(project) };
  await library.setOrigin(id, next);
  if (useEditor.getState().project.id === id) useLinkedOrigin.setState({ origin: next });
  return { ...r, link: publicLink(r.file) };
}
