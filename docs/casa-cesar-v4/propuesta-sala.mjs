// Propuesta 2D: sala, cocina, escalera y techo liviano de la terraza -> propuesta-sala-NN.png
// node docs/casa-cesar-v4/propuesta-sala.mjs NN
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const N = process.argv[2] || '01';
const S = 58;
const C = { verde: '#d9ead0', verdeT: '#557a43', muro: '#2b2b2b', piso: '#fbf8f3', pend: '#c0601c', gris: '#7a786d', madera: '#b77e53', acero: '#4a5a6a', vidrio: '#4f9fd1', techo: '#7a5aa6', cocina: '#efe6d8' };
let s = '';
// Each panel has its own origin (ox, oy) in px and maps plan metres (x, y) with y0 at the top.
let OX = 0, OY = 0, Y0 = 0;
const X = (m) => OX + m * S, Y = (m) => OY + (m - Y0) * S;
const panel = (ox, oy, y0) => { OX = ox; OY = oy; Y0 = y0; };
const rect = (x, y, w, h, o = {}) => (s += `<rect x="${X(x)}" y="${Y(y)}" width="${w * S}" height="${h * S}" fill="${o.fill || 'none'}" stroke="${o.stroke || 'none'}" stroke-width="${o.sw || 1}" ${o.dash ? `stroke-dasharray="${o.dash}"` : ''} ${o.op ? `fill-opacity="${o.op}"` : ''}/>`);
const txt = (x, y, t, o = {}) => (s += `<text x="${X(x)}" y="${Y(y)}" font-size="${o.size || 13}" fill="${o.color || '#222'}" text-anchor="${o.anchor || 'middle'}" font-weight="${o.bold ? 700 : 400}" ${o.rot ? `transform="rotate(${o.rot} ${X(x)} ${Y(y)})"` : ''}>${t}</text>`);
const line = (x1, y1, x2, y2, o = {}) => (s += `<line x1="${X(x1)}" y1="${Y(y1)}" x2="${X(x2)}" y2="${Y(y2)}" stroke="${o.stroke || '#666'}" stroke-width="${o.sw || 1}" ${o.dash ? `stroke-dasharray="${o.dash}"` : ''} ${o.arrow ? 'marker-end="url(#fl)"' : ''}/>`);
const door = (x, y, w, dir) => { // swing arc for a door in a horizontal (h) or vertical (v) wall
  if (dir === 'h') s += `<path d="M${X(x)},${Y(y)} a${w * S},${w * S} 0 0 1 ${w * S},${w * S}" fill="none" stroke="#888" stroke-dasharray="3 3"/>`;
  else s += `<path d="M${X(x)},${Y(y)} a${w * S},${w * S} 0 0 0 ${w * S},${-w * S}" fill="none" stroke="#888" stroke-dasharray="3 3"/>`;
};
const glass = (x1, y1, x2, y2) => line(x1, y1, x2, y2, { stroke: C.vidrio, sw: 6 });
const gap = (x1, y1, x2, y2) => line(x1, y1, x2, y2, { stroke: '#fff', sw: 7 });
const num = (x, y, n) => { s += `<circle cx="${X(x)}" cy="${Y(y)}" r="11" fill="${C.pend}"/>`; txt(x, y + 0.08, n, { size: 13, color: '#fff', bold: true }); };

// ===================== Planta baja =====================
panel(60, 70, 15.5);
txt(3.5, 15.1, 'PLANTA BAJA · propuesta', { bold: true, size: 17 });
rect(-0.6, 15.5, 8.2, 17, { fill: C.verde });
txt(7.35, 22, 'jardín de la casa →', { color: C.verdeT, size: 12, rot: 90 });
// Habitación 3 (contexto)
rect(1.8, 15.5, 4.7, 0.5, { fill: '#eee', stroke: C.muro, sw: 2.5 });
txt(3.5, 15.9, 'Hab. 3', { size: 11, color: C.gris });
// Escalera recta pegada al muro de la cocina, sube hacia la izquierda
rect(1.9, 18, 4.5, 1, { fill: '#e9ddcf', stroke: C.madera, sw: 2 });
for (let i = 1; i < 16; i++) line(1.9 + i * 0.28, 18, 1.9 + i * 0.28, 19, { stroke: C.madera });
line(6.25, 18.5, 2.05, 18.5, { stroke: C.muro, sw: 2, arrow: true });
txt(5.95, 17.85, 'arranque', { size: 11, color: C.madera, bold: true });
rect(1.0, 18, 0.9, 1, { fill: 'none', stroke: C.madera, sw: 1.5, dash: '5 4' });
txt(1.45, 17.85, 'descanso', { size: 10.5, color: C.madera });
txt(3.9, 17.5, '① Escalera recta · 16 huellas de 28 cm', { bold: true, size: 13, color: C.madera });
txt(3.9, 17.0, 'zancas de acero ancladas al muro de la cocina', { size: 11, color: C.gris });
txt(2.9, 16.45, 'Jardín intermedio 7 × 3 · descubierto', { color: C.verdeT, size: 12, bold: true });
// Debajo de la escalera
txt(2.55, 18.82, 'lavado', { size: 10.5, color: C.gris });
txt(4.05, 18.82, 'alacena', { size: 10.5, color: C.pend, bold: true });
// Bloque social
rect(1, 19, 5.5, 7, { fill: C.piso, stroke: C.muro, sw: 3 });
// Hall + baño social
rect(2.1, 19, 1.2, 2, { fill: '#e6eef3', stroke: C.muro, sw: 2.5 });
txt(2.7, 19.85, '③ Baño', { bold: true, size: 12 });
txt(2.7, 20.25, 'social', { bold: true, size: 12 });
txt(2.7, 20.65, '1,20 × 2', { size: 10.5, color: C.gris });
gap(2.1, 19.55, 2.1, 20.3); door(2.1, 20.3, 0.7, 'v');
txt(1.55, 20.9, 'hall', { size: 11, color: C.gris });
gap(1.15, 19, 2.05, 19); glass(1.15, 19, 2.05, 19); // puerta al jardín (vidrio)
txt(1.6, 19.35, '② jardín', { size: 10.5, color: C.vidrio, bold: true });
gap(1, 19.8, 1, 20.65); door(1, 20.65, 0.85, 'v');
txt(0.45, 20.25, 'servicio', { size: 10.5, color: C.pend, rot: -90, bold: true });
// Alacena: puerta oculta desde la cocina, en el muro del fondo
gap(3.45, 19, 4.15, 19); line(3.45, 19, 4.15, 19, { stroke: C.pend, sw: 3, dash: '4 3' });
// Cocina a la derecha, en vertical
rect(5.8, 19.1, 0.6, 3.8, { fill: C.cocina, stroke: '#8a7a66', sw: 1.5 });
rect(5.75, 19.15, 0.65, 0.75, { fill: '#cfd6dc', stroke: '#8a7a66' }); txt(6.08, 19.6, 'nevera', { size: 9.5, rot: 90 });
txt(6.1, 20.6, 'lavaplatos', { size: 9.5, rot: 90 });
rect(5.85, 21.35, 0.5, 0.6, { fill: '#555', op: 0.25, stroke: '#333' }); txt(6.1, 21.65, 'estufa', { size: 9.5, rot: 90 });
rect(5.95, 21.2, 0.5, 0.9, { stroke: C.techo, sw: 2, dash: '4 3' });
txt(5.7, 22.75, 'campana + extractor', { size: 10, color: C.techo, bold: true, anchor: 'end' });
txt(6.1, 22.5, 'horno', { size: 9.5, rot: 90 });
rect(4.0, 19.7, 0.85, 1.9, { fill: '#e2d3c2', stroke: '#8a7a66', sw: 1.5 });
txt(4.42, 20.55, 'isla', { size: 11, bold: true });
for (const x of [4.15, 4.7]) s += `<circle cx="${X(x)}" cy="${Y(21.85)}" r="7" fill="#c6b1a0"/>`;
txt(4.42, 22.25, 'desayunador', { size: 10, color: C.gris });
txt(5.3, 19.45, '④ Cocina', { bold: true, size: 13 });
// Comedor
rect(1.7, 21.6, 1.8, 0.9, { fill: '#d8bfa6', stroke: '#8a6446' });
for (const x of [2.0, 2.6, 3.2]) for (const y of [21.4, 22.7]) s += `<circle cx="${X(x)}" cy="${Y(y)}" r="7" fill="#c6b1a0"/>`;
txt(2.6, 22.15, '⑤ Comedor', { bold: true, size: 12 });
// Sala doble altura
line(1, 23, 6.5, 23, { stroke: '#bbb', dash: '6 5' });
txt(3.75, 23.4, '⑥ Sala · doble altura', { bold: true, size: 14 });
rect(1.12, 23.6, 0.45, 2.0, { fill: '#8a6446', op: 0.7 }); txt(1.35, 24.6, 'TV', { size: 11, color: '#fff', bold: true, rot: 90 });
rect(2.2, 23.5, 0.95, 2.3, { fill: '#c6b1a0', stroke: '#8a7a66' }); txt(2.68, 24.65, 'sofá', { size: 11, rot: 90 });
rect(4.6, 24.0, 0.8, 0.8, { fill: '#c6b1a0', stroke: '#8a7a66' }); rect(4.6, 24.9, 0.8, 0.8, { fill: '#c6b1a0', stroke: '#8a7a66' });
txt(5.0, 25.95 - 0.05, 'butacas', { size: 10, color: C.gris });
rect(3.35, 24.05, 1.0, 1.4, { fill: '#e8dbd3', stroke: '#b9a89a' });
// Ventanas panorámicas laterales y fachada
glass(1, 21.3, 1, 22.9); glass(1, 23.3, 1, 25.7);
glass(6.5, 21.95, 6.5, 25.75); glass(6.5, 20.4, 6.5, 21.1);
glass(2.6, 26, 6.3, 26);
gap(1.2, 26, 2.3, 26); line(1.2, 26, 2.3, 26, { stroke: C.madera, sw: 6 });
txt(1.75, 26.45, 'puerta', { size: 11, color: C.madera, bold: true });
txt(4.45, 26.45, 'fachada de vidrio a doble altura', { size: 11, color: C.vidrio, bold: true });
txt(6.85, 23.9, 'ventanal corredizo', { size: 10.5, color: C.vidrio, bold: true, rot: 90 });
txt(0.55, 24.5, 'ventanal', { size: 10.5, color: C.vidrio, bold: true, rot: -90 });
// flechas de aire cruzado
for (const y of [22.3, 24.5]) line(7.4, y, 7.05, y, { stroke: '#4f9fd1', sw: 1.5, arrow: true });
// Frente
rect(1.5, 26, 5, 1.6, { fill: '#e8e4dc' });
txt(4.0, 27.0, 'estacionamiento', { size: 11, color: C.gris });
rect(1.2, 26.05, 1.1, 0.6, { fill: 'none', stroke: C.madera, dash: '4 3' });
txt(1.75, 27.0, 'alero', { size: 10.5, color: C.madera });
for (const x of [0.4, 0.4]) s += `<circle cx="${X(x)}" cy="${Y(27.2)}" r="8" fill="#6d8f4e"/>`;
// recorrido sala → jardín
s += `<path d="M${X(3.0)},${Y(23.9)} L${X(1.55)},${Y(21.5)} L${X(1.55)},${Y(19.3)}" fill="none" stroke="${C.pend}" stroke-width="2.5" stroke-dasharray="7 5" marker-end="url(#fl2)"/>`;

// ===================== Planta alta =====================
panel(610, 70, 15.5);
txt(3.5, 15.1, 'PLANTA ALTA · terraza y techo liviano', { bold: true, size: 17 });
rect(-0.6, 15.5, 8.2, 11.4, { fill: '#f2f2ef' });
rect(1.4, 15.5, 5.2, 0.6, { fill: '#ddd' }); txt(4, 15.95, 'losa de las habitaciones', { size: 10.5, color: C.gris });
// Escalera (llega por la izquierda) y descanso
rect(1.9, 18, 4.5, 1, { fill: '#e9ddcf', stroke: C.madera, sw: 1.5 });
line(6.25, 18.5, 2.05, 18.5, { stroke: C.muro, sw: 2, arrow: true });
rect(1.0, 18, 0.9, 1, { fill: '#d6b48f', stroke: C.madera, sw: 2 });
txt(1.45, 17.8, 'llegada', { size: 10.5, color: C.madera, bold: true });
// Terraza
rect(1, 19, 5.5, 4, { fill: '#e6d2bd', stroke: '#9b8b7a', sw: 1.5 });
txt(3.75, 20.7, '⑦ Terraza 5,5 × 4', { bold: true, size: 14 });
txt(3.75, 21.15, 'piso de madera · baranda de vidrio', { size: 11, color: C.gris });
glass(1.9, 19, 6.5, 19); glass(6.5, 19, 6.5, 23); glass(1, 19, 1, 23); glass(1, 18, 1.9, 18); glass(1, 18, 1, 19);
// Techo liviano
rect(0.85, 17.85, 5.8, 5.15, { stroke: C.techo, sw: 2.5, dash: '9 6' });
txt(3.75, 22.05, 'TECHO LIVIANO sobre escalera + terraza', { size: 12, color: C.techo, bold: true });
txt(3.75, 22.45, 'panel termoacústico sobre vigas de acero', { size: 11, color: C.techo });
for (const [x, y] of [[1.05, 19.05], [6.45, 19.05]]) rect(x - 0.08, y - 0.08, 0.16, 0.16, { fill: C.acero });
txt(0.7, 19.55, 'columna', { size: 10, color: C.acero, anchor: 'end' });
txt(0.7, 19.85, 'de acero', { size: 10, color: C.acero, anchor: 'end' });
line(1, 19, 6.5, 19, { stroke: C.acero, sw: 3 });
txt(3.75, 18.0 - 0.2, 'voladizo 1,15 m sobre la escalera', { size: 10.5, color: C.techo });
// Sala doble altura
rect(1, 23, 5.5, 3, { fill: '#fbf8f3', stroke: C.muro, sw: 3 });
txt(3.75, 24.3, 'vacío de la sala', { bold: true, size: 13 });
txt(3.75, 24.75, '(doble altura)', { size: 11, color: C.gris });
glass(2.6, 23, 6.3, 23); glass(2.6, 26, 6.3, 26);
glass(1, 23.4, 1, 25.6); glass(6.5, 23.4, 6.5, 25.6);
txt(3.75, 25.55, 'ventanas altas a los lados: sale el aire caliente', { size: 10.5, color: C.vidrio });
line(1, 23, 6.5, 23, { stroke: C.acero, sw: 0 });
txt(-0.15, 23.15, 'muro de la sala', { size: 10, color: C.gris, anchor: 'start' });


// ===================== Habitaciones gemelas =====================
panel(640, 880, 8);
txt(4.15, 7.35, 'HAB. 2 Y 3 (gemelas) · giradas 180°', { bold: true, size: 16 });
rect(1.0, 8, 0.8, 4, { fill: '#f3e7da' }); txt(1.4, 10.2, 'pasillo', { size: 10.5, color: C.gris, rot: -90 });
rect(1.8, 8, 4.7, 4, { fill: C.piso, stroke: C.muro, sw: 3 });
rect(1.8, 8, 1.6, 2.2, { fill: '#e6eef3', stroke: C.muro, sw: 2 }); txt(2.6, 9.15, 'Baño', { bold: true, size: 12 });
rect(1.8, 10.2, 1.6, 1.0, { fill: '#efe2d2', stroke: C.muro, sw: 2 }); txt(2.6, 10.8, 'vestidor', { size: 11, bold: true });
gap(2.3, 10.2, 2.9, 10.2); gap(3.4, 10.35, 3.4, 11.05);
txt(2.6, 11.7, 'entrada →', { size: 10.5, color: C.gris });
gap(1.8, 11.25, 1.8, 11.95); door(1.8, 11.95, 0.7, 'v');
rect(4.15, 8.1, 1.6, 2.1, { fill: '#e8dbd3', stroke: '#b9a89a' }); txt(4.95, 9.2, 'cama queen', { size: 11 });
rect(4.45, 11.8, 1.0, 0.15, { fill: '#222' }); txt(4.95, 11.65, 'TV', { size: 10.5, bold: true });
glass(6.5, 8.35, 6.5, 11.65);
txt(6.9, 10.0, 'ventanal → jardín', { size: 10.5, color: C.vidrio, bold: true, rot: 90 });
line(3.55, 8.15, 3.55, 9.0, { stroke: '#8a6446', sw: 4 }); txt(3.75, 9.4, 'cuadros', { size: 10, color: '#8a6446', anchor: 'start' });

// ===================== Corte =====================
// Corte longitudinal (plan y en horizontal, altura en vertical), mirando desde la izquierda.
const CX0 = 1160, CY0 = 820, CS = 44;
const cx = (y) => CX0 + (y - 15.5) * CS, cy = (z) => CY0 - z * CS;
const cr = (y0, z0, y1, z1, o = {}) => (s += `<rect x="${cx(y0)}" y="${cy(z1)}" width="${(y1 - y0) * CS}" height="${(z1 - z0) * CS}" fill="${o.fill || 'none'}" stroke="${o.stroke || 'none'}" stroke-width="${o.sw || 1}" ${o.dash ? `stroke-dasharray="${o.dash}"` : ''}/>`);
const cl = (y0, z0, y1, z1, o = {}) => (s += `<line x1="${cx(y0)}" y1="${cy(z0)}" x2="${cx(y1)}" y2="${cy(z1)}" stroke="${o.stroke || '#333'}" stroke-width="${o.sw || 1}" ${o.dash ? `stroke-dasharray="${o.dash}"` : ''}/>`);
const ct = (y, z, t, o = {}) => (s += `<text x="${cx(y)}" y="${cy(z)}" font-size="${o.size || 12}" fill="${o.color || '#222'}" text-anchor="${o.anchor || 'middle'}" font-weight="${o.bold ? 700 : 400}">${t}</text>`);
s += `<text x="${CX0}" y="${cy(7.2)}" font-size="17" font-weight="700">CORTE · por qué el techo sí aguanta</text>`;
cl(15, 0, 27.2, 0, { sw: 2 });
cr(15.2, 0, 16, 3, { fill: '#eee', stroke: C.muro }); cr(15.2, 3, 16.1, 3.2, { fill: '#bbb' }); ct(15.6, 1.5, 'Hab.3', { size: 10.5 });
// stair seen as a ramp of the side, along the kitchen wall (in this cut it is the band y 18–19)
cr(18, 0, 19, 3, { fill: '#e9ddcf', stroke: C.madera, dash: '4 3' }); ct(18.5, 1.4, 'escalera', { size: 10.5, color: C.madera });
// kitchen + terrace slab
cr(19, 0, 23, 3, { fill: C.piso, stroke: C.muro, sw: 2 }); cr(19, 3, 23, 3.25, { fill: '#9a9a9a' });
ct(21, 1.4, 'cocina · comedor', { size: 11 });
ct(21, 3.55, 'terraza', { size: 11, bold: true });
// living double height
cr(23, 0, 26, 6, { fill: C.piso, stroke: C.muro, sw: 2 }); cr(22.9, 6, 26.1, 6.25, { fill: '#9a9a9a' });
ct(24.5, 3, 'sala', { size: 11, bold: true }); ct(24.5, 2.5, 'doble altura', { size: 10.5, color: C.gris });
cl(26, 0.05, 26, 5.85, { stroke: C.vidrio, sw: 5 });
// light roof: beams + panel, gentle slope
cl(17.85, 5.55, 23, 5.8, { stroke: C.techo, sw: 5 });
for (const y of [19.05]) { cl(y, 3.25, y, 5.6, { stroke: C.acero, sw: 5 }); }
cl(23, 5.8, 23, 5.8, {});
ct(20.4, 6.55, 'techo liviano (panel termoacústico, ≈ 12 kg/m²)', { size: 11, color: C.techo, bold: true });
ct(19.05, 4.4, 'columna', { size: 10, color: C.acero, anchor: 'end' });
ct(18.95, 4.05, 'acero 10×10', { size: 10, color: C.acero, anchor: 'end' });
ct(22.95, 5.2, 'apoya en el', { size: 10, color: C.gris, anchor: 'end' });
ct(22.95, 4.85, 'muro de la sala', { size: 10, color: C.gris, anchor: 'end' });
ct(17.6, 5.25, 'voladizo', { size: 10, color: C.techo, anchor: 'start' });
// load arrows down the column and wall
for (const [y, z0, z1] of [[19.05, 3.1, 0.3], [23, 5.6, 0.3]]) s += `<line x1="${cx(y) + 10}" y1="${cy(z0)}" x2="${cx(y) + 10}" y2="${cy(z1)}" stroke="${C.pend}" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#fl2)"/>`;
ct(16.9, -0.45, 'jardín', { size: 10.5, color: C.verdeT }); ct(26.6, -0.45, 'calle →', { size: 10.5, color: C.gris });

// ===================== Notas =====================
let ny = 7.0; const NX = 1160;
const note = (t, o = {}) => { s += `<text x="${NX}" y="${70 + ny * 22}" font-size="${o.size || 13}" fill="${o.color || '#222'}" font-weight="${o.bold ? 700 : 400}">${t}</text>`; ny += o.gap || 1; };
ny = 0;
note('Casa Cesar versión 4 · propuesta sala ' + N, { bold: true, size: 18, gap: 1.4 });
note('① Escalera recta de un tramo pegada al muro de la cocina.', { bold: true });
note('   Arranca a la derecha, con el jardín grande delante: hay espacio para subir.');
note('   Huellas de 28 cm (antes 21). Llega a un descanso y de ahí a la terraza.');
note('   Debajo de la parte alta: lavado y la alacena de la cocina (puerta oculta).');
note('② Salida al jardín por un hall a la izquierda, fuera de la cocina.', { bold: true });
note('   Sala → hall → jardín en línea recta (flecha naranja); el hall también');
note('   recibe la puerta de servicio y la del ③ baño social.');
note('④ Cocina a la derecha, en vertical: nevera, lavaplatos, estufa con', { bold: true });
note('   campana y extractor al exterior, horno; isla con 2 puestos de desayuno.');
note('⑥ Sala: ventanales a los dos lados (aire cruzado) y ventanas altas en', { bold: true });
note('   la doble altura para que salga el aire caliente.');
note('   Fachada de vidrio alineada abajo y arriba, igual que la de la terraza.');
note('⑦ Techo liviano de acero y panel termoacústico sobre TODA la terraza', { bold: true, color: C.techo });
note('   y la escalera: 2 columnas en las esquinas de la cocina + el muro de la', { color: C.techo });
note('   sala. Sobre la escalera queda en voladizo de 1,15 m: sin postes en el jardín.', { color: C.techo, gap: 1.4 });
note('Hab. 2 y 3: baño y vestidor pasan a la izquierda; el dormitorio queda', { bold: true });
note('   a la derecha con ventanal hacia el jardín. Sigue una sola entrada:');
note('   dormitorio → vestidor → baño. Cama, TV enfrente y cuadros.');

const W = 1960, H = 1170;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Roboto, Segoe UI, Arial"><defs><marker id="fl" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="${C.muro}"/></marker><marker id="fl2" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="${C.pend}"/></marker></defs><rect width="100%" height="100%" fill="#fff"/>${s}</svg>`;
writeFileSync(join(here, `propuesta-sala-${N}.svg`), svg);
const { chromium } = await import(pathToFileURL(join(root, 'node_modules/playwright/index.mjs')).href);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1.5 });
await p.setContent(`<body style="margin:0">${svg}</body>`);
await p.screenshot({ path: join(here, `propuesta-sala-${N}.png`) });
await b.close();
console.log('ok');
