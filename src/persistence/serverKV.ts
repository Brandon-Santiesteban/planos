import type { KV } from './library';

/** Storage in the biblioteca/ folder of the PC running the app (dev server, see vite.config.ts). */
export function serverKV(base = '/api/kv/', fetcher: typeof fetch = (...a) => fetch(...a)): KV {
  const url = (k: string) => `${base}${encodeURIComponent(k)}`;
  return {
    async get(k) {
      const res = await fetcher(url(k), { cache: 'no-store' });
      if (res.status === 404) return undefined;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    },
    async set(k, v) {
      const res = await fetcher(url(k), { method: 'PUT', body: v });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },
    async del(k) {
      const res = await fetcher(url(k), { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
    },
  };
}

/**
 * `localOnly` keys stay in the browser: «the project I had open» belongs to each computer.
 * The PC is the real store, so projects are the same whatever link or computer opens the app; the browser keeps a
 * copy so the app still works if the PC can't be reached. Writes go to both: a failure on the PC is reported.
 */
export function syncedKV(local: KV, remote: KV, localOnly: string[] = ['ultimo']): KV {
  return {
    async get(k) {
      if (localOnly.includes(k)) return local.get(k);
      let r: string | undefined;
      try {
        r = await remote.get(k);
      } catch {
        return local.get(k);
      }
      if (r === undefined) return local.get(k);
      void local.set(k, r).catch(() => {});
      return r;
    },
    async set(k, v) {
      if (localOnly.includes(k)) return local.set(k, v);
      await local.set(k, v).catch(() => {});
      await remote.set(k, v);
    },
    async del(k) {
      await local.del(k).catch(() => {});
      await remote.del(k);
    },
  };
}

const INDEX = 'proyectos';
const DONE = 'subido-al-pc';

/**
 * Once per browser: uploads the projects this browser kept only for itself (before the PC stored them) so they show
 * up everywhere. Projects the PC already has are left alone.
 */
export async function uploadLocalProjects(local: KV, remote: KV): Promise<number> {
  if (await local.get(DONE)) return 0;
  const parse = (t: string | undefined) => {
    try {
      return JSON.parse(t ?? '[]') as { id: string; updatedAt: number }[];
    } catch {
      return [];
    }
  };
  const mine = parse(await local.get(INDEX));
  const theirs = parse(await remote.get(INDEX));
  const missing = mine.filter((e) => !theirs.some((t) => t.id === e.id));
  for (const e of missing) {
    for (const key of [`proyecto:${e.id}`, `origen:${e.id}`]) {
      const v = await local.get(key);
      if (v !== undefined) await remote.set(key, v);
    }
  }
  if (missing.length) await remote.set(INDEX, JSON.stringify([...theirs, ...missing].sort((a, b) => b.updatedAt - a.updatedAt)));
  await local.set(DONE, '1');
  return missing.length;
}
