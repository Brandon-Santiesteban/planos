// Gives an example project a fresh id so browsers that opened an older copy load the new one.
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) {
  console.error('Uso: node scripts/nuevo-id-ejemplo.mjs <archivo.casa.json>');
  process.exit(1);
}
const p = JSON.parse(readFileSync(path, 'utf8'));
p.id = randomUUID();
writeFileSync(path, JSON.stringify(p, null, 2));
console.log(`Nuevo id para ${path}: ${p.id}`);
