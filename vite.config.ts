/// <reference types="vitest/config" />
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import type { IncomingMessage } from 'node:http';
import { promisify } from 'node:util';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const PUBLIC = fileURLToPath(new URL('./public', import.meta.url));
const EJEMPLOS = join(PUBLIC, 'ejemplos');
const ROOT = fileURLToPath(new URL('.', import.meta.url));
/** Browser tests run with --mode e2e: they never publish anything. */
let E2E = false;
/** The user's projects, saved on this PC whatever link or computer they draw from. */
let BIBLIOTECA = fileURLToPath(new URL('./biblioteca', import.meta.url));

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * Write to a temporary file first, so a half-written project never replaces a good one. Windows refuses the rename
 * for a moment while the file is being read, so it is retried; a file kept open for longer (the dev server's own
 * file watcher does that on Windows) is written in place instead, once the full text is known to be on disk.
 */
async function writeSafely(path: string, text: string) {
  const tmp = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  writeFileSync(tmp, text);
  for (let i = 0; ; i++) {
    try {
      return renameSync(tmp, path);
    } catch (e) {
      if (i >= 20) {
        try {
          writeFileSync(path, text);
          return;
        } catch {
          throw e;
        } finally {
          rmSync(tmp, { force: true });
        }
      }
      await new Promise((r) => setTimeout(r, 25));
    }
  }
}

/** One write at a time per file: two saves arriving together never trip over each other. */
const queues = new Map<string, Promise<unknown>>();
function queued<T>(path: string, job: () => Promise<T>): Promise<T> {
  const run = (queues.get(path) ?? Promise.resolve()).catch(() => {}).then(job);
  queues.set(path, run);
  return run;
}

/** One line per project file in public/ejemplos, for the Mis proyectos gallery. */
function catalogo() {
  return readdirSync(EJEMPLOS)
    .filter((f) => f.endsWith('.casa.json'))
    .flatMap((f) => {
      try {
        const p = JSON.parse(readFileSync(join(EJEMPLOS, f), 'utf8')) as { id?: string; name?: string; floors?: unknown[] };
        const base = basename(f, '.casa.json');
        const vista = ['jpg', 'png'].map((ext) => `vistas/${base}.${ext}`).find((v) => existsSync(join(EJEMPLOS, v)));
        return [{
          file: `ejemplos/${f}`, id: p.id ?? '', name: p.name ?? base, floors: p.floors?.length ?? 1,
          updatedAt: Math.round(statSync(join(EJEMPLOS, f)).mtimeMs),
          preview: vista ? `ejemplos/${vista}?v=${Math.round(statSync(join(EJEMPLOS, vista)).mtimeMs)}` : null,
        }];
      } catch {
        return []; // half-written file: it shows up on the next request
      }
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

const run = promisify(execFile);
const git = (...args: string[]) => run('git', args, { cwd: ROOT });

/** File name for a project shared for the first time: its name without accents, never another project's file. */
function freeFile(id: string | undefined, name: string): string {
  const base = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'proyecto';
  for (let n = 1; ; n++) {
    const file = `ejemplos/${base}${n > 1 ? `-${n}` : ''}.casa.json`;
    const path = join(PUBLIC, file);
    if (!existsSync(path)) return file;
    try {
      if ((JSON.parse(readFileSync(path, 'utf8')) as { id?: string }).id === id) return file;
    } catch {
      // unreadable: take another name
    }
  }
}

/**
 * Publishes a project file: a commit with only that file, pushed to GitHub on the current branch and on main, which
 * the public site deploys (the app code committed so far goes along).
 */
async function publish(path: string, name: string) {
  const rel = relative(ROOT, path).replaceAll('\\', '/');
  await git('add', '--', rel);
  const changed = await git('diff', '--cached', '--quiet', '--', rel).then(() => false, () => true);
  if (changed) await git('commit', '-m', `Compartir «${name}»`, '--', rel);
  await git('push', 'origin', 'HEAD');
  await git('push', 'origin', 'HEAD:main');
}

/** Serves /ejemplos/catalogo.json and tells the open pages when a project file changes, so they update by themselves. */
/** Changes whenever the app's code does (dev server). */
let appVersion = Date.now().toString(36);

function ejemplos(): Plugin {
  return {
    name: 'ejemplos',
    config(_c, { mode }) {
      // Browser tests (npm run e2e) get an empty folder of their own, never the user's projects.
      E2E = mode === 'e2e';
      if (mode === 'e2e') {
        BIBLIOTECA = fileURLToPath(new URL('./test-results/biblioteca-e2e', import.meta.url));
        rmSync(BIBLIOTECA, { recursive: true, force: true });
      }
    },
    transformIndexHtml() {
      return [{ tag: 'meta', attrs: { name: 'app-version', content: appVersion }, injectTo: 'head' }];
    },
    configureServer(server) {
      // The app's code must never be kept by the browser: a restored tab or a reload would run an old version.
      // (Pre-bundled libraries under /node_modules/.vite keep their long cache: their URLs change with them.)
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/node_modules/.vite/')) {
          const setHeader = res.setHeader.bind(res);
          res.setHeader = (name, value) => setHeader(name, String(name).toLowerCase() === 'cache-control' && value === 'no-cache' ? 'no-store' : value);
        }
        next();
      });
      // Version of the app code: changes whenever a source file does (see src/persistence/appUpdates.ts).
      server.middlewares.use('/api/version', (_req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.end(appVersion);
      });
      server.watcher.on('all', (_event, path) => {
        const rel = relative(fileURLToPath(new URL('.', import.meta.url)), path).replaceAll('\\', '/');
        if (rel.startsWith('src/') || rel === 'index.html') appVersion = Date.now().toString(36);
      });
      server.middlewares.use('/ejemplos/catalogo.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify(catalogo()));
      });
      // Key–value storage for the projects library: biblioteca/<key>.json (see src/persistence/serverKV.ts).
      server.middlewares.use('/api/kv/', (req, res) => {
        const key = decodeURIComponent((req.url ?? '').slice(1).split('?')[0]);
        if (!/^[\w:.-]{1,120}$/.test(key)) return void (res.statusCode = 400, res.end());
        const file = join(BIBLIOTECA, `${key.replaceAll(':', '_')}.json`);
        void (async () => {
          try {
            if (req.method === 'GET') {
              if (!existsSync(file)) return void (res.statusCode = 404, res.end());
              res.setHeader('Cache-Control', 'no-store');
              res.end(readFileSync(file, 'utf8'));
            } else if (req.method === 'PUT') {
              const text = await readBody(req);
              mkdirSync(BIBLIOTECA, { recursive: true });
              await queued(file, () => writeSafely(file, text));
              res.end();
            } else if (req.method === 'DELETE') {
              await queued(file, async () => rmSync(file, { force: true }));
              res.end();
            } else {
              res.statusCode = 405;
              res.end();
            }
          } catch {
            res.statusCode = 500;
            res.end();
          }
        })();
      });
      // Renames a project file in public/ejemplos (only its name: the id and the link stay). Answers with the new text.
      server.middlewares.use('/api/renombrar', (req, res) => {
        void (async () => {
          try {
            const { file, name } = JSON.parse(await readBody(req)) as { file: string; name: string };
            if (req.method !== 'POST' || !/^ejemplos\/[\w.-]+\.casa\.json$/.test(file) || !name?.trim()) return void (res.statusCode = 400, res.end());
            const path = join(PUBLIC, file);
            const text = await queued(path, async () => {
              const p = JSON.parse(readFileSync(path, 'utf8'));
              p.name = name.trim();
              const t = JSON.stringify(p, null, 2);
              await writeSafely(path, t);
              return t;
            });
            res.end(text);
          } catch {
            res.statusCode = 500;
            res.end();
          }
        })();
      });
      // «Compartir»: writes the project as a file of the app (its own file if it already has one) and publishes it,
      // so its fixed link on the public site shows this version. Answers { file, published, error? }.
      server.middlewares.use('/api/compartir', (req, res) => {
        void (async () => {
          try {
            if (req.method !== 'POST' || E2E) return void (res.statusCode = 403, res.end());
            const { file, text } = JSON.parse(await readBody(req)) as { file?: string; text: string };
            const project = JSON.parse(text) as { id?: string; name?: string };
            const name = project.name?.trim() || 'Proyecto';
            const target = file && /^ejemplos\/[\w.-]+\.casa\.json$/.test(file) ? file : freeFile(project.id, name);
            const path = join(PUBLIC, target);
            await queued(path, () => writeSafely(path, JSON.stringify(project, null, 2)));
            let error: string | undefined;
            await queued('git', () => publish(path, name)).catch((e: Error) => void (error = e.message.split('\n').slice(-3).join(' ')));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ file: target, published: !error, error }));
          } catch {
            res.statusCode = 500;
            res.end();
          }
        })();
      });
      server.watcher.add(EJEMPLOS);
      const onChange = (path: string) => {
        if (!path.endsWith('.casa.json') || !path.startsWith(EJEMPLOS)) return;
        server.ws.send({ type: 'custom', event: 'ejemplo-cambiado', data: { file: relative(PUBLIC, path).replaceAll('\\', '/') } });
      };
      server.watcher.on('change', onChange);
      server.watcher.on('add', onChange);
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'ejemplos/catalogo.json', source: JSON.stringify(catalogo()) });
    },
  };
}

export default defineConfig({
  plugins: [react(), ejemplos()],
  // Permite abrir la app desde otra red con un túnel de cloudflared.
  server: { allowedHosts: ['.trycloudflare.com', '.ts.net'] },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
