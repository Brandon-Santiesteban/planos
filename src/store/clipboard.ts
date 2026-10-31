// Ctrl+C / Ctrl+V: copy and paste walls (with their doors and windows), rooms and furniture.
import { newId } from '../model/ids';
import type { Furniture, Opening, Room, Wall } from '../model/types';
import { notify } from '../ui/toasts';
import { type Item, useEditor } from './editorStore';

/** What was copied travels through the system clipboard as text starting with this, so it survives a reload. */
const CLIP_PREFIX = 'casa-plano:';

interface Clip {
  floorId: string;
  walls: Wall[];
  /** doors and windows of the copied walls */
  openings: Opening[];
  rooms: Room[];
  furniture: Furniture[];
}

/** The last clipboard text pasted and how many times, so repeated pastes don't pile up. */
let lastPaste: { text: string; count: number } | null = null;

const count = (c: Clip) => c.walls.length + c.rooms.length + c.furniture.length;

/** «1 muro», «2 muebles», «1 muro y 3 muebles»… */
export function describe(c: Pick<Clip, 'walls' | 'rooms' | 'furniture'>): string {
  const parts = [
    [c.walls.length, 'muro', 'muros'],
    [c.rooms.length, 'habitación', 'habitaciones'],
    [c.furniture.length, 'mueble', 'muebles'],
  ] as const;
  const named = parts.filter(([n]) => n > 0).map(([n, one, many]) => `${n} ${n === 1 ? one : many}`);
  return named.length > 1 ? `${named.slice(0, -1).join(', ')} y ${named[named.length - 1]}` : named[0] ?? '';
}

/**
 * Ctrl+C: the selected wall, room or piece, or everything in a box selection, as clipboard text (null if nothing
 * that can be copied is selected). A copied wall takes its doors and windows along.
 */
export function copySelection(): string | null {
  const { project, activeFloorId, selection, group } = useEditor.getState();
  const floor = project.floors.find((f) => f.id === activeFloorId);
  if (!floor) return null;
  const items = [selection, ...group].filter((x): x is Item => !!x);
  const ids = (kind: Item['kind']) => new Set(items.filter((x) => x.kind === kind).map((x) => x.id));
  const walls = floor.walls.filter((w) => ids('wall').has(w.id));
  const wallIds = new Set(walls.map((w) => w.id));
  const clip: Clip = {
    floorId: activeFloorId,
    walls,
    openings: floor.openings.filter((o) => wallIds.has(o.wallId)),
    rooms: floor.rooms.filter((r) => ids('room').has(r.id)),
    furniture: floor.furniture.filter((f) => ids('furniture').has(f.id)),
  };
  if (!count(clip)) return null;
  lastPaste = null;
  return CLIP_PREFIX + JSON.stringify(clip);
}

function parse(text: string): Clip | null {
  if (!text.startsWith(CLIP_PREFIX)) return null;
  try {
    const c = JSON.parse(text.slice(CLIP_PREFIX.length)) as Partial<Clip>;
    const clip: Clip = { floorId: c.floorId ?? '', walls: c.walls ?? [], openings: c.openings ?? [], rooms: c.rooms ?? [], furniture: c.furniture ?? [] };
    return count(clip) ? clip : null;
  } catch {
    return null;
  }
}

/**
 * Ctrl+V: pastes what the clipboard text holds, 30 cm further down and right each time on the same floor (so copies
 * don't pile up), or in the same spot on another floor. The copies end up selected. False if it holds nothing of
 * the plan.
 */
export function pasteClipboard(text: string): boolean {
  const clip = parse(text);
  if (!clip) return false;
  const n = lastPaste?.text === text ? lastPaste.count + 1 : 1;
  const { apply, activeFloorId, select, selectGroup } = useEditor.getState();
  const step = activeFloorId === clip.floorId ? 0.3 * n : 0;
  const move = <T extends { x: number; y: number }>(p: T): T => ({ ...p, x: p.x + step, y: p.y + step });
  const pasted: Item[] = [];
  apply((d) => {
    const floor = d.floors.find((f) => f.id === activeFloorId);
    if (!floor) return;
    const wallIds = new Map<string, string>();
    for (const w of clip.walls) {
      const id = newId();
      wallIds.set(w.id, id);
      floor.walls.push({ ...structuredClone(w), id, a: move(w.a), b: move(w.b) });
      pasted.push({ kind: 'wall', id });
    }
    for (const o of clip.openings) {
      const wallId = wallIds.get(o.wallId);
      if (wallId) floor.openings.push({ ...structuredClone(o), id: newId(), wallId });
    }
    for (const r of clip.rooms) {
      const id = newId();
      floor.rooms.push({ ...structuredClone(r), id, points: r.points.map(move) });
      pasted.push({ kind: 'room', id });
    }
    for (const f of clip.furniture) {
      const id = newId();
      floor.furniture.push({ ...structuredClone(f), id, x: f.x + step, y: f.y + step });
      pasted.push({ kind: 'furniture', id });
    }
  });
  lastPaste = { text, count: n };
  if (pasted.length === 1) select(pasted[0]);
  else selectGroup(pasted);
  return true;
}

/**
 * Ctrl+C / Ctrl+V on the page through the browser's own copy and paste events (they also come from the Edit menu
 * and work over any link). Text fields keep their normal copy and paste.
 */
export function startClipboard(): () => void {
  const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  const onCopy = (e: ClipboardEvent) => {
    if (typing(e.target) || typing(document.activeElement)) return;
    const text = copySelection();
    if (!text) {
      if (!window.getSelection()?.toString()) notify({ kind: 'info', text: 'Selecciona un muro, una habitación o un mueble para copiarlo' });
      return;
    }
    e.clipboardData?.setData('text/plain', text);
    e.preventDefault();
    notify({ kind: 'ok', text: `Copiado: ${describe(parse(text)!)}. Ctrl+V para pegar` });
  };
  const onPaste = (e: ClipboardEvent) => {
    if (typing(e.target) || typing(document.activeElement)) return;
    e.preventDefault();
    if (!pasteClipboard(e.clipboardData?.getData('text/plain') ?? '')) notify({ kind: 'info', text: 'Primero copia algo del plano con Ctrl+C' });
  };
  document.addEventListener('copy', onCopy);
  document.addEventListener('paste', onPaste);
  return () => {
    document.removeEventListener('copy', onCopy);
    document.removeEventListener('paste', onPaste);
  };
}
