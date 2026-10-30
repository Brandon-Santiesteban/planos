import { create } from 'zustand';
import { useEditor } from '../store/editorStore';
import { notify } from '../ui/toasts';
import type { Library, Origin } from './library';
import { adoptFile, hashProject, hashText, linkFor } from './openFromUrl';

const POLL_MS = 8000;

/** The file the open project comes from, if any (shown in Mis proyectos and used for «Copiar enlace»). */
export const useLinkedOrigin = create<{ origin: Origin | null }>()(() => ({ origin: null }));

/** Puts the open project's own link in the address bar (or none), keeping the other parameters such as `vista`. */
function syncAddressBar(file: string | null) {
  const q = new URLSearchParams(location.search);
  q.delete('p');
  q.delete('abrir');
  q.delete('biblioteca');
  const own = file ? linkFor(file).slice(1) : '';
  const rest = q.toString();
  const search = [own, rest].filter(Boolean).join('&');
  history.replaceState(null, '', `${location.pathname}${search ? `?${search}` : ''}`);
}

/**
 * Keeps a project opened from a file (`?p=…`) in step with that file: the address bar always holds the project's
 * link, so a reload reopens it; and when the file changes (Claude updated it) the new version is shown by itself.
 * If the user has changed the project in the meantime, they are asked first.
 */
export function startLiveLink({ lib, fetchText }: { lib: Library; fetchText: (path: string) => Promise<string> }): () => void {
  let stopped = false;
  let checking = false;
  /** File hash already offered to the user, so the same «versión nueva» toast isn't repeated. */
  let offered: string | null = null;

  async function follow() {
    const id = useEditor.getState().project.id;
    const origin = await lib.origin(id).catch(() => null);
    if (stopped || useEditor.getState().project.id !== id) return;
    useLinkedOrigin.setState({ origin });
    syncAddressBar(origin?.file ?? null);
    // Opened from Mis proyectos: the file may have changed since this copy was saved.
    void check();
  }

  async function load(origin: Origin, text: string) {
    const r = await adoptFile(origin.file, text, lib);
    // Skip it if another project was opened meanwhile.
    if (!r || stopped || useEditor.getState().project.id !== r.project.id) return;
    useEditor.getState().refreshProject(r.project);
    useLinkedOrigin.setState({ origin: await lib.origin(r.project.id) });
    notify({ kind: 'ok', text: `«${r.project.name}» se actualizó con los últimos cambios` });
    if (r.notice) notify({ kind: 'info', text: r.notice });
  }

  async function check() {
    const { origin } = useLinkedOrigin.getState();
    if (!origin || checking || stopped) return;
    checking = true;
    try {
      const text = await fetchText(`/${origin.file}`);
      const fileHash = hashText(text);
      const project = useEditor.getState().project;
      if (fileHash === origin.fileHash) return;
      if (hashProject(project) === origin.projectHash) {
        await load(origin, text);
      } else if (offered !== fileHash) {
        offered = fileHash;
        notify({
          kind: 'info',
          text: `Hay una versión nueva de «${project.name}»`,
          action: {
            label: 'Cargarla',
            run: () => void lib.save(useEditor.getState().project).then(() => load(origin, text)),
          },
        });
      }
    } catch {
      // Offline or the file is being written: try again on the next tick.
    } finally {
      checking = false;
    }
  }

  void follow();
  const unsubscribe = useEditor.subscribe((s, prev) => {
    if (s.loadCount !== prev.loadCount) {
      offered = null;
      void follow();
    }
  });
  const timer = setInterval(() => document.visibilityState === 'visible' && void check(), POLL_MS);
  const onVisible = () => document.visibilityState === 'visible' && void check();
  document.addEventListener('visibilitychange', onVisible);
  // The dev server says right away when a file in public/ejemplos changes (see vite.config.ts).
  const onChanged = (data: { file: string }) => {
    if (data.file === useLinkedOrigin.getState().origin?.file) void check();
  };
  import.meta.hot?.on('ejemplo-cambiado', onChanged);

  return () => {
    stopped = true;
    unsubscribe();
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    import.meta.hot?.off('ejemplo-cambiado', onChanged);
  };
}
