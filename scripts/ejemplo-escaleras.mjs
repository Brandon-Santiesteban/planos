// Turns every room named exactly "Escalera" into a U-shaped stairs going up towards the front of the plan.
// Usage: node scripts/ejemplo-escaleras.mjs public/ejemplos/casa-etapa-1.casa.json
// Idempotent: running it again changes nothing.
import { readFileSync, writeFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) {
  console.error('Uso: node scripts/ejemplo-escaleras.mjs <archivo.casa.json>');
  process.exit(1);
}

const text = readFileSync(path, 'utf8');
const project = JSON.parse(text);
let count = 0;
for (const floor of project.floors) {
  for (const room of floor.rooms) {
    if (room.name !== 'Escalera') continue;
    // In the example the stairs sit at the front (bottom of the plan) and arrive back towards
    // Entrada/Pasillo at the top, so the first flight climbs towards the front: up = 's'.
    room.kind = 'stairs';
    room.stairShape = 'u';
    room.up = 's';
    count++;
  }
}

const out = JSON.stringify(project, null, 2) + (text.endsWith('\n') ? '\n' : '');
if (out !== text) writeFileSync(path, out);
console.log(`${count} escalera(s) en U en ${path}${out === text ? ' (sin cambios)' : ''}`);
