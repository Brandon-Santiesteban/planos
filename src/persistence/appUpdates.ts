import { useEditor } from '../store/editorStore';
import { notify } from '../ui/toasts';
import type { Library } from './library';

const POLL_MS = 8000;

/** The app code version this page was loaded with (the dev server writes it into index.html). */
const loaded = () => document.querySelector<HTMLMetaElement>('meta[name="app-version"]')?.content ?? null;

/**
 * Keeps an open page on the latest app code even when live updates don't reach it (a tab restored by the browser,
 * a tunnel that dropped the live connection). When the code changed, the page reloads by itself as soon as the
 * user comes back to it, after saving the project; while they are on it, a notice offers «Recargar».
 */
export function startAppUpdates({ lib }: { lib: Library }): () => void {
  let mine = loaded();
  if (!mine) return () => {}; // a built copy (npm run build) has no live version to follow
  let offered: string | null = null;
  let stopped = false;

  const reload = async () => {
    await lib.save(useEditor.getState().project).catch(() => {});
    if (!stopped) location.reload();
  };

  async function check() {
    try {
      const r = await fetch('/api/version', { cache: 'no-store' });
      const current = r.ok ? await r.text() : null;
      if (stopped || !current || current === mine) return;
      if (document.visibilityState === 'hidden') return; // reloaded on coming back (onVisible)
      if (offered === current) return;
      offered = current;
      notify({ kind: 'info', text: 'Hay cambios nuevos en la app', action: { label: 'Recargar', run: () => void reload() } });
    } catch {
      // Offline: try again later.
    }
  }

  const onVisible = async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const r = await fetch('/api/version', { cache: 'no-store' });
      const current = r.ok ? await r.text() : null;
      if (!stopped && current && current !== mine) await reload();
    } catch {
      // Offline.
    }
  };

  // Code the live connection did update needs no reload.
  const onUpdated = () => {
    void fetch('/api/version', { cache: 'no-store' }).then((r) => (r.ok ? r.text() : null)).then((v) => {
      if (v) mine = v;
    }).catch(() => {});
  };
  import.meta.hot?.on('vite:afterUpdate', onUpdated);
  document.addEventListener('visibilitychange', onVisible);
  const timer = setInterval(() => void check(), POLL_MS);
  void check();
  return () => {
    stopped = true;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    import.meta.hot?.off('vite:afterUpdate', onUpdated);
  };
}
