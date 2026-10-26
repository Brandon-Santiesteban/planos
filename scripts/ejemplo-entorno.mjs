// Adds the street in front of the example house and the proposed green strip across it.
// Plain Node, idempotent: removes what it added before (rooms in ENTORNO, furniture ids starting with "entorno-").
// Usage: node scripts/ejemplo-entorno.mjs public/ejemplos/casa-etapa-1.casa.json
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) {
  console.error('Uso: node scripts/ejemplo-entorno.mjs <archivo.casa.json>');
  process.exit(1);
}

// Plan: north up, the house front (street side) is the bottom edge at y = 9 and its fence reaches y = 10,2.
const FRONT = 10.2;
const SIDEWALK = 1.5; // andén frente a la casa
const ROAD = 7.0; // calzada en doble sentido (2 carriles de 3,5 m)
const FAR_SIDEWALK = 0.6; // sardinel / borde del otro lado
const GREEN = 3.0; // franja de tierra que se propone como zona verde
const X0 = -8;
const X1 = 13.5; // show the neighbours' frontage too

const rect = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const yRoad = FRONT + SIDEWALK;
const yFar = yRoad + ROAD;
const yGreen = yFar + FAR_SIDEWALK;
const ENTORNO = [
  { name: 'Andén', points: rect(X0, FRONT, X1, yRoad), floorMaterial: 'concreto' },
  { name: 'Calle (doble sentido)', points: rect(X0, yRoad, X1, yFar), floorMaterial: 'asfalto' },
  { name: 'Sardinel', points: rect(X0, yFar, X1, yGreen), floorMaterial: 'concreto' },
  { name: 'Zona verde (propuesta)', points: rect(X0, yGreen, X1, yGreen + GREEN), floorMaterial: 'cesped' },
];

// Catalog sizes (src/furniture/catalog.ts).
const PIECES = {
  'arbol-guayacan': { w: 3.0, d: 3.0, h: 6.0, color: '#6a8c42' },
  'arbol-pequeno': { w: 2.0, d: 2.0, h: 3.5, color: '#5d8642' },
  arbusto: { w: 1.0, d: 1.0, h: 1.0, color: '#557e3c' },
  'poste-alumbrado': { w: 0.3, d: 1.2, h: 6.0, color: '#3b3f45' },
  'porton-telescopico': { w: 3.3, d: 0.12, h: 2.0, color: '#1e1e1e' },
};
const yTrees = yGreen + GREEN / 2;
const PLACED = [
  // Guayacanes every ~6 m, small trees between them, shrubs near the kerb.
  ['arbol-guayacan', -5.5, yTrees], ['arbol-guayacan', 2.75, yTrees], ['arbol-guayacan', 11, yTrees],
  ['arbol-pequeno', -1.4, yTrees + 0.3], ['arbol-pequeno', 6.9, yTrees + 0.3],
  ['arbusto', -3.5, yGreen + 0.7], ['arbusto', 0.6, yGreen + 0.7], ['arbusto', 4.9, yGreen + 0.7], ['arbusto', 9, yGreen + 0.7],
  // The existing power pole on the house-side sidewalk, to the RIGHT of the house (user), arm over the street.
  ['poste-alumbrado', 6.1, FRONT + 0.4],
  // Telescopic sliding gate on the fence line in front of the parking (closed); open, its two leaves stack
  // behind the garden fence (x 3,3…5,0) and the whole 3,3 m are free for the car.
  ['porton-telescopico', 1.65, FRONT - 0.06],
];

const p = JSON.parse(readFileSync(path, 'utf8'));
const ground = p.floors[0];
const names = new Set(ENTORNO.map((e) => e.name));
ground.rooms = ground.rooms.filter((r) => !names.has(r.name));
ground.furniture = (ground.furniture ?? []).filter((f) => !f.id.startsWith('entorno-'));
for (const e of ENTORNO) ground.rooms.push({ id: randomUUID(), kind: 'exterior', ...e });
for (const [type, x, y] of PLACED) {
  const s = PIECES[type];
  ground.furniture.push({
    id: `entorno-${randomUUID()}`, type, x, y, rotation: 0, width: s.w, depth: s.d, height: s.h, elevation: 0, color: s.color,
  });
}
writeFileSync(path, JSON.stringify(p, null, 2));
console.log(`Entorno: ${ENTORNO.length} zonas y ${PLACED.length} árboles/postes en ${path}`);
