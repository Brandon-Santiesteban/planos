// Propuesta 2D (2026-11-14, segunda ronda): escalera en S desde la sala con baño y alacena debajo, sala a la derecha,
// pasillo a la derecha de las habitaciones, una sola habitación abajo + habitación arriba por un puente, frente libre.
// node docs/casa-cesar-v4/propuesta-02.mjs NN   -> propuesta-NN.png
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const N = process.argv[2] || '02';
const S = 31;
const C = { verde: '#d9ead0', verdeT: '#557a43', muro: '#2b2b2b', piso: '#fbf8f3', pend: '#c0601c', gris: '#6f6d63', madera: '#b77e53', acero: '#4a5a6a', vidrio: '#3f93c9', techo: '#7a5aa6', bano: '#e3edf3', piedra: '#cfc8bb', conc: '#e4e1da' };
let s = '';
let OX = 0, OY = 0;
const X = (m) => OX + m * S, Y = (m) => OY + m * S;
const panel = (ox, oy) => { OX = ox; OY = oy; };
const rect = (x0, y0, x1, y1, o = {}) => (s += `<rect x="${X(x0)}" y="${Y(y0)}" width="${(x1 - x0) * S}" height="${(y1 - y0) * S}" fill="${o.fill || 'none'}" stroke="${o.stroke || 'none'}" stroke-width="${o.sw || 1}" ${o.dash ? `stroke-dasharray="${o.dash}"` : ''} ${o.op ? `fill-opacity="${o.op}"` : ''}/>`);
const txt = (x, y, t, o = {}) => (s += `<text x="${X(x)}" y="${Y(y)}" font-size="${o.size || 11}" fill="${o.color || '#222'}" text-anchor="${o.anchor || 'middle'}" font-weight="${o.bold ? 700 : 400}" ${o.rot ? `transform="rotate(${o.rot} ${X(x)} ${Y(y)})"` : ''}>${t}</text>`);
const line = (x1, y1, x2, y2, o = {}) => (s += `<line x1="${X(x1)}" y1="${Y(y1)}" x2="${X(x2)}" y2="${Y(y2)}" stroke="${o.stroke || '#666'}" stroke-width="${o.sw || 1}" ${o.dash ? `stroke-dasharray="${o.dash}"` : ''} ${o.arrow ? `marker-end="url(#${o.arrow})"` : ''}/>`);
const W = (x1, y1, x2, y2, sw = 3) => line(x1, y1, x2, y2, { stroke: C.muro, sw });
const gap = (x1, y1, x2, y2) => line(x1, y1, x2, y2, { stroke: '#fff', sw: 6 });
const glass = (x1, y1, x2, y2) => { gap(x1, y1, x2, y2); line(x1, y1, x2, y2, { stroke: C.vidrio, sw: 4 }); };
const dr = (x1, y1, x2, y2) => { gap(x1, y1, x2, y2); line(x1, y1, x2, y2, { stroke: C.madera, sw: 2, dash: '3 2' }); };
const num = (x, y, n) => { s += `<circle cx="${X(x)}" cy="${Y(y)}" r="9" fill="${C.pend}"/>`; txt(x, y + 0.13, n, { size: 11, color: '#fff', bold: true }); };
const bed = (x0, y0, x1, y1) => { rect(x0, y0, x1, y1, { fill: '#e8dbd3', stroke: '#b9a89a' }); rect(x0 + 0.1, y0 + 0.08, x1 - 0.1, y0 + 0.45, { fill: '#fff', stroke: '#b9a89a' }); };
// U stair seen from above, going up north on x0..x0+2 from y1 to y0 (landing at y0..y0+1).
const stairU = (x0, y0, y1, label = true) => {
  rect(x0, y0, x0 + 2, y1, { fill: '#efe3d4', stroke: C.madera, sw: 1.5 });
  rect(x0, y0, x0 + 2, y0 + 1, { fill: '#e2cfb8', stroke: C.madera });
  const run = y1 - (y0 + 1), d = run / 9;
  for (let k = 1; k < 9; k++) { line(x0, y0 + 1 + k * d, x0 + 2, y0 + 1 + k * d, { stroke: C.madera }); }
  line(x0 + 1, y0 + 1, x0 + 1, y1, { stroke: C.muro, sw: 2 });
  line(x0 + 0.5, y1 - 0.1, x0 + 0.5, y0 + 0.55, { stroke: C.pend, sw: 2, arrow: 'fl2' });
  line(x0 + 0.55, y0 + 0.5, x0 + 1.45, y0 + 0.5, { stroke: C.pend, sw: 2 });
  line(x0 + 1.5, y0 + 0.55, x0 + 1.5, y1 - 0.1, { stroke: C.pend, sw: 2, arrow: 'fl2' });

};

// ===================== PLANTA BAJA =====================
panel(40, 70);
txt(5.5, -1.1, 'PLANTA BAJA', { bold: true, size: 17 });
rect(0, 0, 11, 32, { fill: C.verde });
txt(9.2, 12, 'jardín de la casa →', { color: C.verdeT, size: 12, rot: 90 });
line(0.1, 0.1, 0.1, 31.9, { stroke: '#4f7a3a', sw: 4 }); line(0.1, 0.1, 11, 0.1, { stroke: '#4f7a3a', sw: 4 });
txt(5.5, 1.15, 'jardín posterior', { color: C.verdeT, size: 10.5 });
// Master suite (mirrored: bedroom on the right, bath + walk-in on the left)
rect(1, 2, 6.5, 8, { fill: C.piso });
rect(1, 2, 3.6, 5, { fill: C.bano }); rect(1, 5, 3.6, 8, { fill: '#efe2d2' });
W(1, 2, 6.5, 2); W(1, 2, 1, 8); W(6.5, 2, 6.5, 8); W(1, 8, 6.5, 8); W(3.6, 2, 3.6, 8, 2); W(1, 5, 3.6, 5, 2);
glass(4.2, 2, 6.0, 2); dr(3.6, 6.4, 3.6, 7.2); dr(2.0, 5, 2.8, 5); dr(5.75, 8, 6.45, 8);
bed(4.1, 4.0, 6.1, 6.2); txt(5.1, 6.8, 'Hab. principal', { bold: true, size: 12 });
txt(2.3, 3.6, 'Baño', { bold: true }); txt(2.3, 6.6, 'Vestier', { bold: true });
num(6.1, 7.55, '6');
// Right corridor (open, half under the eave)
rect(5.7, 8, 6.5, 16, { fill: '#e9e2d6' }); txt(6.12, 12.0, 'pasillo exterior', { size: 10, color: C.gris, rot: 90 });
// y 8–12: flexible space (question)
rect(1, 8, 5.7, 12, { fill: '#f4f1ea', stroke: C.muro, sw: 2, dash: '6 4' });
txt(3.35, 9.8, 'Estudio / sala TV 4,7 × 4', { bold: true, size: 12, color: C.pend });
txt(3.35, 10.4, '(espacio libre aprobado)', { size: 10.5, color: C.gris });

// Hab. 2 (y 12–16): bath + walk-in on the left wall, bed on the north wall, door from the right corridor
rect(1, 12, 5.7, 16, { fill: C.piso });
rect(1, 12, 2.6, 14.3, { fill: C.bano }); rect(1, 14.3, 2.6, 16, { fill: '#efe2d2' });
W(1, 12, 5.7, 12); W(1, 12, 1, 16); W(1, 16, 5.7, 16); W(5.7, 12, 5.7, 16); W(2.6, 12, 2.6, 16, 2); W(1, 14.3, 2.6, 14.3, 2);
dr(2.6, 14.6, 2.6, 15.3); dr(1.5, 14.3, 2.15, 14.3); dr(5.7, 14.8, 5.7, 15.6);
glass(5.7, 12.3, 5.7, 14.5);
bed(3.35, 12.1, 4.95, 14.1); line(3.55, 15.92, 4.75, 15.92, { stroke: '#222', sw: 4 }); txt(4.15, 15.7, 'TV', { size: 9.5, bold: true });
txt(4.15, 14.9, 'Hab. 2', { bold: true, size: 12 }); txt(1.8, 13.2, 'Baño', { bold: true, size: 10.5 }); txt(1.8, 15.3, 'vestidor', { size: 10 });
num(5.25, 13.0, '5');
// Middle garden
txt(2.6, 16.5, 'Jardín intermedio (patio)', { color: C.verdeT, size: 10, bold: true });
line(5.0, 18.9, 5.5, 16.1, { stroke: C.pend, sw: 1.5, dash: '5 4', arrow: 'fl2' });
// Social block
rect(1, 19, 6.5, 26, { fill: C.piso });
W(1, 19, 6.5, 19); W(1, 19, 1, 26); W(6.5, 19, 6.5, 26); W(1, 26, 6.5, 26);
// Stair: flight 1 inside (from the corridor, north), landing outside at +1,50, flight 2 outside along the back wall (east)
const flight = (x0, y0, x1, y1, n, dir) => {
  rect(x0, y0, x1, y1, { fill: '#efe3d4', stroke: C.madera, sw: 1.5 });
  for (let k = 1; k < n; k++) dir === 'n' ? line(x0, y0 + (k * (y1 - y0)) / n, x1, y0 + (k * (y1 - y0)) / n, { stroke: C.madera }) : line(x0 + (k * (x1 - x0)) / n, y0, x0 + (k * (x1 - x0)) / n, y1, { stroke: C.madera });
};
const stairS = () => {
  flight(1, 19, 2, 21.24, 8, 'n'); rect(1, 18, 2, 19, { fill: '#e2cfb8', stroke: C.madera }); flight(2, 18, 4.24, 19, 8, 'e');
  line(1.5, 21.15, 1.5, 18.55, { stroke: C.pend, sw: 2 }); line(1.5, 18.5, 4.05, 18.5, { stroke: C.pend, sw: 2, arrow: 'fl2' });
};
gap(1.05, 19, 1.95, 19);
stairS();
txt(0.55, 18.55, '+1,50', { size: 9.5, color: C.madera, bold: true });
num(0.55, 20.3, '1');
// Social bathroom under the outdoor flight (x 2,6–4,35 · y 17,4–19), door from the house
rect(2.6, 17.4, 4.35, 18, { fill: C.bano }); rect(2.6, 18, 4.24, 19, { fill: C.bano, op: 0.55 });
W(2.6, 17.4, 4.35, 17.4, 2); W(2.6, 17.4, 2.6, 19, 2); W(4.35, 17.4, 4.35, 19, 2);
dr(3.6, 19, 4.25, 19);
txt(3.45, 17.85, 'baño social', { size: 10, bold: true });
num(2.25, 17.55, '2');
// Arrival platform at +3,00 over the patio door (drawn as a dashed outline)
rect(4.24, 18, 5.7, 19, { stroke: C.madera, dash: '4 3' });
txt(4.97, 18.35, 'llegada +3', { size: 8.5, color: C.madera });
glass(4.45, 19, 5.6, 19); txt(5.0, 19.45, 'corrediza', { size: 9, color: C.vidrio, bold: true });
// Under the bridge: alacena (sliding door from the kitchen) and the service area
rect(5.7, 18, 6.5, 19, { fill: '#eadfcd' }); W(5.7, 18, 6.5, 18, 2); W(5.7, 18, 5.7, 19, 2); W(6.5, 16, 6.5, 19, 2);
gap(5.75, 19, 6.45, 19); line(5.75, 19, 6.45, 19, { stroke: C.pend, sw: 2.5, dash: '4 2' });
txt(6.1, 18.6, 'alacena', { size: 8.5, bold: true, color: C.pend });
rect(5.7, 16, 6.5, 18, { fill: '#e8e4dc' }); W(5.7, 16, 6.5, 16, 2);
rect(5.85, 16.15, 6.45, 16.75, { fill: '#fff', stroke: '#999' }); rect(5.85, 16.95, 6.45, 17.55, { fill: '#fff', stroke: '#999' });
txt(6.12, 17.95, 'servicio', { size: 8.5, color: C.gris, bold: true });
num(7.05, 17.4, '8');
// Kitchen on the right wall, island, dining
rect(5.85, 19.8, 6.45, 22.6, { fill: '#e2d6c6', stroke: '#8a7a66' });
txt(6.15, 21.2, 'cocina', { size: 10, rot: 90, bold: true });
rect(5.95, 21.6, 6.45, 22.3, { stroke: C.techo, sw: 1.5, dash: '3 2' });
rect(4.4, 20.2, 5.05, 21.9, { fill: '#e2d3c2', stroke: '#8a7a66' }); txt(4.72, 21.1, 'isla', { size: 9.5, rot: 90 });
for (const y of [20.6, 21.4]) s += `<circle cx="${X(4.15)}" cy="${Y(y)}" r="5" fill="#c6b1a0"/>`;
rect(2.45, 19.75, 3.35, 21.55, { fill: '#d8bfa6', stroke: '#8a6446' });
for (const y of [20.05, 20.65, 21.25]) for (const x of [2.22, 3.58]) s += `<circle cx="${X(x)}" cy="${Y(y)}" r="5" fill="#c6b1a0"/>`;
txt(2.9, 20.7, 'comedor', { size: 9.5, rot: 90 });
// Living room shifted right: TV on the right wall
line(2.0, 23, 6.5, 23, { stroke: '#bbb', dash: '6 5' });
rect(6.1, 23.3, 6.45, 25.7, { fill: '#8a6446' }); txt(6.28, 24.5, 'TV', { size: 10, color: '#fff', bold: true, rot: 90 });
s += `<path d="M${X(2.4)},${Y(23.4)} h${0.85 * S} v${1.6 * S} h${1.75 * S} v${0.85 * S} h${-2.6 * S} z" fill="#c6b1a0" stroke="#8a7a66"/>`;
rect(3.6, 23.6, 4.6, 24.8, { fill: '#e8dbd3', stroke: '#b9a89a' });
txt(4.4, 25.85, 'Sala doble altura', { bold: true, size: 11 });
num(5.35, 23.55, '3');
// Corridor from the front door to the stair
rect(1.05, 21.3, 1.95, 25.95, { fill: '#f0e6d8', op: 0.7 });
line(1.5, 25.8, 1.5, 21.45, { stroke: C.pend, sw: 2.5, dash: '6 4', arrow: 'fl2' });
txt(1.5, 24.2, 'pasillo', { size: 10, color: C.pend, bold: true, rot: -90 });
glass(1, 23.3, 1, 25.7); glass(2.6, 26, 6.3, 26);
dr(1.2, 26, 2.3, 26); txt(1.75, 26.5, 'puerta', { size: 9.5, color: C.madera, bold: true });
glass(6.5, 22.1, 6.5, 22.9);
// Front: stone path in line with the door, grass on the left, cars moved right
rect(0, 26, 1.15, 32, { fill: C.verde });
rect(1.15, 26, 2.35, 32, { fill: C.piedra });
for (let y = 26.3; y < 32; y += 0.75) rect(1.3, y, 2.2, y + 0.5, { fill: '#b5ac9c' });
rect(2.5, 26, 7.0, 32, { fill: C.conc });
rect(2.75, 27.0, 4.55, 31.5, { fill: '#5d6d7e', op: 0.85 }); rect(5.0, 27.0, 6.8, 31.5, { fill: '#495762', op: 0.85 });
txt(3.65, 29.3, 'carro', { size: 10, color: '#fff' }); txt(5.9, 29.3, 'carro', { size: 10, color: '#fff' });
txt(1.75, 31.7, 'camino', { size: 9.5, color: C.gris, bold: true }); txt(0.58, 30.5, 'césped', { size: 9.5, color: C.verdeT, rot: -90 });
num(1.75, 28.8, '4');
txt(5.5, 32.7, 'calle', { size: 11, color: C.gris });

// ===================== PLANTA ALTA =====================
panel(470, 70);
txt(4.0, -1.1, 'PLANTA ALTA (+3,00)', { bold: true, size: 17 });
rect(0, 0, 8, 27, { fill: '#f2f2ef' });
rect(1.4, 1.9, 6.6, 12, { fill: '#ddd' }); txt(3.9, 7, 'losa (techo de abajo)', { size: 10.5, color: C.gris });
// Hab. 3 over Hab. 2, same layout (bath over bath, bed on the same wall)
rect(1, 12, 5.7, 16, { fill: C.piso });
rect(1, 12, 2.6, 14.3, { fill: C.bano }); rect(1, 14.3, 2.6, 16, { fill: '#efe2d2' });
W(1, 12, 5.7, 12); W(1, 12, 1, 16); W(1, 16, 5.7, 16); W(5.7, 12, 5.7, 16); W(2.6, 12, 2.6, 16, 2); W(1, 14.3, 2.6, 14.3, 2);
dr(2.6, 14.6, 2.6, 15.3); dr(1.5, 14.3, 2.15, 14.3); dr(5.7, 14.8, 5.7, 15.6);
glass(5.7, 12.3, 5.7, 14.5); glass(3.4, 16, 5.0, 16);
bed(3.35, 12.1, 4.95, 14.1); line(3.55, 15.92, 4.75, 15.92, { stroke: '#222', sw: 4 });
txt(4.15, 14.9, 'Hab. 3 (arriba)', { bold: true, size: 12 }); txt(1.8, 13.2, 'Baño', { bold: true, size: 10.5 }); txt(1.8, 15.3, 'vestidor', { size: 10 });
// Balcony + bridge on the right
rect(5.7, 12, 6.5, 19, { fill: '#e6d2bd', stroke: '#9b8b7a' });
glass(6.5, 12, 6.5, 19); glass(5.7, 16, 5.7, 19);
txt(6.12, 17.5, 'puente', { size: 10.5, bold: true, rot: 90 });
txt(6.12, 13.6, 'balcón', { size: 10, rot: 90 });
num(7.1, 17.5, '7');
txt(3.0, 16.9, '(abajo: jardín intermedio)', { size: 10, color: C.verdeT });
// Terrace with the stair: well over flight 1, flight 2 outside, arrival platform joining terrace and bridge
rect(1, 19, 6.5, 23, { fill: '#e6d2bd', stroke: '#9b8b7a' });
rect(4.24, 18, 5.7, 19, { fill: '#e6d2bd', stroke: '#9b8b7a' });
rect(1, 19, 2, 21.24, { fill: '#fff' }); stairS();
glass(2, 19, 2, 21.24); glass(1, 21.24, 2, 21.24); glass(1, 18, 4.24, 18); glass(2, 19, 4.24, 19); glass(4.24, 18, 5.7, 18);
txt(4.0, 21.3, 'Terraza', { bold: true, size: 13 });
txt(4.97, 18.62, 'llegada', { size: 9.5, color: C.pend, bold: true });
glass(1, 19, 1, 23); glass(6.5, 19, 6.5, 23);
// Light roof over terrace + stair + bridge
s += `<path d="M${X(0.85)},${Y(17.85)} H${X(5.6)} V${Y(15.95)} H${X(6.65)} V${Y(23)} H${X(0.85)} Z" fill="none" stroke="${C.techo}" stroke-width="2.5" stroke-dasharray="9 6"/>`;
txt(2.9, 17.55, 'techo liviano', { size: 10, color: C.techo, bold: true });
for (const [x, y] of [[1.06, 19.06], [6.44, 19.06]]) rect(x - 0.08, y - 0.08, x + 0.08, y + 0.08, { fill: C.acero });
// Living room void
rect(1, 23, 6.5, 26, { fill: '#fbf8f3', stroke: C.muro, sw: 3 });
txt(3.75, 24.5, 'vacío de la sala (doble altura)', { size: 10.5, color: C.gris });

// ===================== NOTAS =====================
let ny = 0; const NX = 760;
const note = (t, o = {}) => { s += `<text x="${NX}" y="${80 + ny * 21}" font-size="${o.size || 13}" fill="${o.color || '#222'}" font-weight="${o.bold ? 700 : 400}">${t}</text>`; ny += o.gap || 1; };
note('Casa Cesar v4 · propuesta ' + N, { bold: true, size: 18, gap: 1.5 });
note('① Escalera en dos tramos', { bold: true });
note('   Tramo 1 DENTRO: del pasillo de la izquierda sube hacia el fondo');
note('   hasta un descanso a +1,50 que ya queda afuera, en el jardín.');
note('   Tramo 2 AFUERA: sigue pegado al muro del fondo hacia la derecha');
note('   hasta una llegada a +3,00 que da a la terraza y al puente.', { gap: 1.3 });
note('② Baño social debajo del tramo de afuera (1,75 × 1,6), con puerta', { bold: true });
note('   desde el comedor. Lavamanos y sanitario en la franja de altura completa.', { gap: 1.3 });
note('⑧ Debajo del puente: alacena junto a la cocina (puerta corrediza', { bold: true });
note('   directa desde la cocina) y, el resto, la zona de servicio (lavadora + lavadero).', { gap: 1.3 });
note('③ Sala a la derecha: TV en el muro derecho, sofá en L mirándolo.', { bold: true });
note('   Donde estaba el TV queda el pasillo hacia la escalera, con ventanal.');
note('   Salida al patio: corrediza de vidrio bajo la llegada de la escalera.');
note('   Cocina en el muro derecho con isla; comedor junto a la escalera.', { gap: 1.3 });
note('④ Frente: camino de piedra alineado con la puerta, césped a la', { bold: true });
note('   izquierda y los dos carros corridos a la derecha; pasillo libre.', { gap: 1.3 });
note('⑤ Una sola habitación abajo (Hab. 2) con baño y vestidor', { bold: true });
note('   en el muro izquierdo y la cama en el muro del fondo.');
note('   Pasillo exterior ahora a la DERECHA, puerta por ese lado.', { gap: 1.3 });
note('⑥ Habitación principal: entra por la derecha (al final del pasillo).', { bold: true, gap: 1.3 });
note('⑦ Hab. 3 arriba, encima de la Hab. 2 y con la misma distribución', { bold: true });
note('   (baño sobre baño, cama en el mismo muro). Desde la terraza cruzas');
note('   un puente techado sobre el jardín y un balcón hasta su puerta;');
note('   el puente y el balcón techan además el pasillo de abajo.', { gap: 1.6 });
note('Espacio libre (y 8–12): estudio / sala de TV familiar.', { bold: true, color: C.pend });

const WW = 1500, HH = 1180;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WW}" height="${HH}" font-family="Roboto, Segoe UI, Arial"><defs><marker id="fl2" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="${C.pend}"/></marker></defs><rect width="100%" height="100%" fill="#fff"/>${s}</svg>`;
writeFileSync(join(here, `propuesta-${N}.svg`), svg);
const { chromium } = await import(pathToFileURL(join(root, 'node_modules/playwright/index.mjs')).href);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: WW, height: HH }, deviceScaleFactor: 1.4 });
await p.setContent(`<body style="margin:0">${svg}</body>`);
await p.screenshot({ path: join(here, `propuesta-${N}.png`) });
await b.close();
console.log('ok');
