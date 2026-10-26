import { create } from 'zustand';

export type ToastKind = 'ok' | 'info' | 'warn' | 'error';
export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
  /** Extra detail copied together with the text for errors. */
  detail?: string;
  action?: { label: string; run: () => void };
}

interface ToastState {
  toasts: Toast[];
  dismiss(id: number): void;
  pause(id: number): void;
  resume(id: number): void;
}

const LIFETIME_MS = 5000;
const MAX_VISIBLE = 3;

// Timer bookkeeping lives outside the store: it's not UI state.
const timers = new Map<number, { handle?: ReturnType<typeof setTimeout>; remaining: number; startedAt: number }>();
let nextId = 1;

function schedule(id: number, ms: number) {
  const handle = setTimeout(() => useToasts.getState().dismiss(id), ms);
  timers.set(id, { handle, remaining: ms, startedAt: Date.now() });
}

export const useToasts = create<ToastState>()((set) => ({
  toasts: [],
  dismiss(id) {
    const t = timers.get(id);
    if (t?.handle) clearTimeout(t.handle);
    timers.delete(id);
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
  },
  pause(id) {
    const t = timers.get(id);
    if (!t?.handle) return;
    clearTimeout(t.handle);
    timers.set(id, { remaining: Math.max(0, t.remaining - (Date.now() - t.startedAt)), startedAt: 0 });
  },
  resume(id) {
    const t = timers.get(id);
    if (t && !t.handle) schedule(id, t.remaining);
  },
}));

/** Shows a notification. Errors stay until closed; the rest leave after 5 s. Returns its id. */
export function notify(t: Omit<Toast, 'id'>): number {
  const id = nextId++;
  const current = useToasts.getState().toasts;
  const overflow = current.slice(0, Math.max(0, current.length - (MAX_VISIBLE - 1)));
  overflow.forEach((x) => useToasts.getState().dismiss(x.id));
  useToasts.setState((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
  if (t.kind !== 'error') schedule(id, LIFETIME_MS);
  return id;
}
