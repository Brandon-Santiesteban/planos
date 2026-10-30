/// <reference types="vitest/config" />
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const PUBLIC = fileURLToPath(new URL('./public', import.meta.url));
const EJEMPLOS = join(PUBLIC, 'ejemplos');

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

/** Serves /ejemplos/catalogo.json and tells the open pages when a project file changes, so they update by themselves. */
function ejemplos(): Plugin {
  return {
    name: 'ejemplos',
    configureServer(server) {
      server.middlewares.use('/ejemplos/catalogo.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify(catalogo()));
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
  server: { allowedHosts: ['.trycloudflare.com'] },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
