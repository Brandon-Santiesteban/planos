import { z } from 'zod';
import type { Project } from '../model/types';

const vec = z.object({ x: z.number().finite(), y: z.number().finite() });
const positive = z.number().finite().positive();

const wall = z.object({
  id: z.string(), a: vec, b: vec, thickness: positive, height: positive.nullable(),
});
const opening = z.object({
  id: z.string(), wallId: z.string(), kind: z.enum(['door', 'window']),
  offset: z.number().finite(), width: positive, height: positive, sill: z.number().finite().min(0),
});
const room = z.object({
  id: z.string(), name: z.string(), kind: z.enum(['room', 'balcony']), points: z.array(vec).min(3),
});
const background = z.object({
  dataUrl: z.string().startsWith('data:'), origin: vec, metresPerPixel: positive,
  opacity: z.number().min(0).max(1), widthPx: positive, heightPx: positive,
});
const floor = z
  .object({
    id: z.string(), name: z.string(), height: positive,
    walls: z.array(wall), openings: z.array(opening), rooms: z.array(room), background: background.nullable(),
  })
  .refine((f) => f.openings.every((o) => f.walls.some((w) => w.id === o.wallId)), {
    message: 'Hay una puerta o ventana en un muro que no existe',
  });
const project = z.object({ version: z.literal(1), name: z.string(), floors: z.array(floor).min(1) });

const INVALID = 'El archivo no es un proyecto válido';

export function serializeProject(p: Project): string {
  return JSON.stringify(p, null, 2);
}

export function parseProject(text: string): { ok: true; project: Project } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: INVALID };
  }
  if (data && typeof data === 'object' && 'version' in data && data.version !== 1) {
    return { ok: false, error: 'Versión de proyecto no compatible' };
  }
  const r = project.safeParse(data);
  if (!r.success) return { ok: false, error: `${INVALID}: ${r.error.issues[0]?.message ?? ''}` };
  return { ok: true, project: r.data as Project };
}

// Minimal File System Access API typings (Chrome/Edge).
type PickerOpts = { suggestedName?: string; types?: { description: string; accept: Record<string, string[]> }[] };
type FsWindow = Window & {
  showSaveFilePicker?: (o: PickerOpts) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (o: PickerOpts) => Promise<FileSystemFileHandle[]>;
};
const FILE_TYPES = [{ description: 'Proyecto de casa', accept: { 'application/json': ['.json'] } }];

function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}

export async function saveProject(p: Project, handle?: FileSystemFileHandle): Promise<FileSystemFileHandle | null> {
  const w = window as FsWindow;
  const text = serializeProject(p);
  if (!w.showSaveFilePicker) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = `${p.name}.casa.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    return null;
  }
  try {
    const h = handle ?? (await w.showSaveFilePicker({ suggestedName: `${p.name}.casa.json`, types: FILE_TYPES }));
    const writable = await (h as FileSystemFileHandle & { createWritable(): Promise<FileSystemWritableFileStream> }).createWritable();
    await writable.write(text);
    await writable.close();
    return h;
  } catch (e) {
    if (isAbort(e)) return null;
    throw e;
  }
}

function pickFileFallback(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

export async function openProject(): Promise<
  { project: Project; handle: FileSystemFileHandle | null } | { error: string } | null
> {
  const w = window as FsWindow;
  let file: File | null;
  let handle: FileSystemFileHandle | null = null;
  try {
    if (w.showOpenFilePicker) {
      [handle] = await w.showOpenFilePicker({ types: FILE_TYPES });
      file = await handle.getFile();
    } else {
      file = await pickFileFallback();
    }
  } catch (e) {
    if (isAbort(e)) return null;
    throw e;
  }
  if (!file) return null;
  const r = parseProject(await file.text());
  return r.ok ? { project: r.project, handle } : { error: r.error };
}
