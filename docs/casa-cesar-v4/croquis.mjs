// Croquis 2D de Casa Cesar versión 4 -> croquis-NN.png  (node docs/casa-cesar-v4/croquis.mjs NN)
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const N = process.argv[2] || '01';
const S = 34, OX = 70, OY = 80; // px por metro, márgenes
const X = (m) => OX + m * S, Y = (m) => OY + m * S;
const C = { verde: '#d9ead0', verdeT: '#557a43', muro: '#2b2b2b', piso: '#fbf8f3', pend: '#c0601c', gris: '#7a786d', pasillo: '#f3e7da' };
let s = '';
const rect = (x, y, w, h, o = {}) => (s += `<rect x="${X(x)}" y="${Y(y)}" width="${w * S}" height="${h * S}" fill="${o.fill || 'none'}" stroke="${o.stroke || 'none'}" stroke-width="${o.sw || 1}" ${o.dash ? `stroke-dasharray="${o.dash}"` : ''}/>`);
const txt = (x, y, t, o = {}) => (s += `<text x="${X(x)}" y="${Y(y)}" font-size="${o.size || 13}" fill="${o.color || '#222'}" text-anchor="${o.anchor || 'middle'}" font-weight="${o.bold ? 700 : 400}" ${o.rot ? `transform="rotate(${o.rot} ${X(x)} ${Y(y)})"` : ''}>${t}</text>`);
const line = (x1, y1, x2, y2, o = {}) => (s += `<line x1="${X(x1)}" y1="${Y(y1)}" x2="${X(x2)}" y2="${Y(y2)}" stroke="${o.stroke || '#666'}" stroke-width="${o.sw || 1}" ${o.dash ? `stroke-dasharray="${o.dash}"` : ''} ${o.arrow ? 'marker-end="url(#fl)"' : ''}/>`);
const room = (x, y, w, h, name, sub, o = {}) => {
  rect(x, y, w, h, { fill: o.fill || C.piso, stroke: C.muro, sw: 2.5 });
  txt(x + w / 2, y + h / 2 + (sub ? -0.05 : 0.15), name, { bold: true, size: o.size || 14 });
  if (sub) txt(x + w / 2, y + h / 2 + 0.45, sub, { size: 10.5, color: C.gris });
};

// Terreno y jardines
// Terreno completo 15 × 32 (lotes E10-45 + E11-46), cerrado por muros a la izquierda, atrás y a la derecha
rect(0, 0, 15, 32, { fill: C.verde });
line(7, 0, 7, 32, { stroke: '#9bb58a', dash: '3 6' });
// Cerca viva (seto) delgada de 1,30 m: izquierda completa y fondo; derecha y frente abiertos
const seto = (x0, y0, x1, y1) => { s += `<line x1="${X(x0)}" y1="${Y(y0)}" x2="${X(x1)}" y2="${Y(y1)}" stroke="#4f7a38" stroke-width="${0.2 * S}" stroke-linecap="round" stroke-dasharray="${0.5 * S} ${0.06 * S}"/>`; };
seto(0.1, 0.1, 0.1, 31.9); seto(0.1, 0.1, 14.9, 0.1);
txt(10.75, 32.6, 'seto 0,20 a la izquierda y al fondo · derecha y frente sin cerca', { size: 10.5, color: '#3d6b2e', bold: true });
txt(3.25, 1.15, 'Jardín posterior', { color: C.verdeT, bold: true });
txt(10.75, 13.5, 'Jardín de la casa', { color: C.verdeT, bold: true, size: 17 });
txt(10.75, 14.2, '8,50 × 32 m · todo el lado derecho', { color: C.verdeT, size: 12 });

// ① Habitación principal 5,5 × 6
room(1, 2, 2.9, 6, '① Hab. principal', 'dormitorio', { size: 13 });
room(3.9, 2, 2.6, 3, 'Baño', '');
room(3.9, 5, 2.6, 3, 'Vestier', '');

// Pasillo lateral 0,80: 0,40 techado (alero) junto al muro + 0,40 descubierto
rect(1, 8, 0.4, 8, { fill: '#e4efd9', stroke: '#9bb58a', sw: 1, dash: '3 3' });
rect(1.4, 8, 0.4, 8, { fill: C.pasillo, stroke: '#b77e53', sw: 1.5, dash: '5 3' });
for (let i = 0; i < 16; i++) line(1.4, 8 + i * 0.5, 1.8, 8.4 + i * 0.5, { stroke: '#d2b49a', sw: 0.8 });
txt(1.25, 12, 'Pasillo 0,80 · descubierto', { size: 10, color: C.verdeT, rot: -90 });
txt(1.68, 12, 'alero techado 0,40', { size: 10, color: '#9a5f33', rot: -90, bold: true });

// ② y ③: dormitorio + vestidor pequeño + baño, una sola entrada (dormitorio → vestidor → baño)
const hab = (y0, n) => {
  room(1.8, y0, 3.1, 4, n, 'dormitorio 3,10 × 4');
  room(4.9, y0, 1.6, 2.2, 'Baño', '');
  room(4.9, y0 + 2.2, 1.6, 1.8, 'Vestidor', '', { size: 12 });
  rect(4.82, y0 + 2.5, 0.16, 0.9, { fill: C.piso }); // vano dormitorio → vestidor
  rect(5.35, y0 + 2.16, 0.75, 0.08, { fill: C.piso }); // puerta vestidor → baño
  rect(1.76, y0 + 3.0, 0.08, 0.85, { fill: C.piso }); // puerta desde el pasillo
  line(1.8, y0 + 3.0, 2.6, y0 + 3.0, { stroke: '#555', sw: 1 });
  s += `<path d="M ${X(2.6)} ${Y(y0 + 3.0)} A ${0.8 * S} ${0.8 * S} 0 0 1 ${X(1.8)} ${Y(y0 + 3.8)}" fill="none" stroke="#999" stroke-dasharray="3 2"/>`;
};
hab(8, '② Hab. 2');
hab(12, '③ Hab. 3');

// ④ Jardín intermedio 7 × 3 descubierto, escalera techada
rect(0, 16, 7, 3, { fill: '#c7e2b8', stroke: C.verdeT, sw: 1.5 });
txt(0.2, 16.75, '④ Jardín intermedio', { color: C.verdeT, bold: true, size: 13, anchor: 'start' });
txt(0.2, 17.25, '7 × 3 · descubierto', { color: C.verdeT, size: 11, anchor: 'start' });
rect(0.15, 18.2, 1.5, 0.7, { fill: '#e6eef2', stroke: '#6b8796', sw: 1.2 });
txt(0.9, 18.65, 'Lavado', { size: 11, color: '#4b6876' });

// Bloque social 19–26
rect(1, 19, 5.5, 7, { fill: C.piso, stroke: C.muro, sw: 2.5 });
line(1, 21.3, 6.5, 21.3, { stroke: '#bbb', dash: '4 4' });
line(1, 23, 6.5, 23, { stroke: '#bbb', dash: '4 4' });
txt(3.95, 20.5, '⑥ Cocina', { bold: true });
txt(3.95, 20.95, '+ desayunador', { size: 10.5, color: C.gris });
txt(3.75, 22.3, '⑦ Comedor', { bold: true });
txt(3.75, 24.6, '⑧ Sala doble altura', { bold: true });
txt(3.75, 25.1, 'techo alto, sin terraza encima', { size: 10.5, color: C.gris });
// terraza en 2º piso sobre cocina y comedor
rect(1.1, 19.1, 5.3, 3.8, { stroke: '#7b5ea7', sw: 2, dash: '10 5' });
txt(6.3, 22.75, '⑪ Terraza arriba', { size: 10.5, color: '#7b5ea7', anchor: 'end', bold: true });

// Escalera en U (opción C) en la esquina derecha del jardín intermedio, baño social bajo el tramo alto
rect(4.3, 16, 2.2, 3, { fill: '#fff', stroke: C.muro, sw: 1.2 });
line(5.4, 17.1, 5.4, 19, { stroke: C.muro, sw: 1.2 });
line(4.3, 17.1, 6.5, 17.1, { stroke: '#777', sw: 1 });
for (let i = 1; i < 9; i++) line(4.3, 17.1 + i * 0.211, 6.5, 17.1 + i * 0.211, { stroke: '#aaa', sw: 0.7 });
line(4.85, 18.85, 4.85, 16.55, { stroke: C.muro, sw: 1.3 });
line(4.85, 16.55, 5.95, 16.55, { stroke: C.muro, sw: 1.3 });
line(5.95, 16.55, 5.95, 18.85, { stroke: C.muro, sw: 1.3, arrow: true });
txt(4.85, 19.35, 'sube', { size: 9.5, color: '#444' });
rect(5.45, 17.9, 1.0, 2.0, { stroke: '#8a6d4e', sw: 2, dash: '6 3' });
line(5.4, 19.0, 5.4, 19.9, { stroke: C.muro, sw: 2 });
line(5.4, 19.9, 6.5, 19.9, { stroke: C.muro, sw: 2 });
rect(5.36, 19.15, 0.08, 0.6, { fill: '#8a6d4e' });
rect(4.15, 15.9, 2.45, 3.25, { stroke: '#b77e53', sw: 2.2, dash: '8 4' });
txt(6.8, 17.3, '← Escalera en U, techo alto', { size: 10.5, color: '#9a5f33', anchor: 'start', bold: true });
txt(6.8, 17.75, '← Alacena (despensa) debajo del tramo alto', { size: 10.5, color: C.pend, anchor: 'start', bold: true });
// ⑤ Baño social 1,50 × 2 donde estaba la despensa, puerta desde la cocina
rect(1, 19, 1.5, 2, { fill: '#eaf1f4', stroke: C.muro, sw: 1.5 });
rect(2.46, 19.75, 0.08, 0.7, { fill: '#eaf1f4' });
txt(1.75, 19.85, '⑤ Baño', { size: 10.5, bold: true }); txt(1.75, 20.2, 'social', { size: 10.5, bold: true }); txt(1.75, 20.6, '1,50 × 2', { size: 9.5, color: C.gris });
// entrada de servicio por el lateral izquierdo hasta la cocina
rect(0.96, 21.05, 0.08, 0.85, { fill: '#c0601c' });
line(0.3, 31.6, 0.3, 21.5, { stroke: C.pend, sw: 1.6, dash: '6 4', arrow: true });
txt(0.3, 21.15, '⑫', { size: 12, color: C.pend, bold: true });
txt(0.12, 24.6, 'servicio → cocina', { size: 10, color: C.pend, rot: -90, bold: true });

// Frente: entrada y estacionamiento
rect(1.5, 26, 5, 6, { fill: '#e9e7e2', stroke: '#999', sw: 1.2, dash: '4 3' });
txt(4, 28.8, '⑩ Estacionamiento', { bold: true });
txt(4, 29.3, '2 carros · 5 × 6', { size: 11, color: C.gris });
for (let i = 0; i < 9; i++) s += `<ellipse cx="${X(0.75)}" cy="${Y(26.5 + i * 0.62)}" rx="${0.33 * S}" ry="${0.2 * S}" fill="#cfc6bb" stroke="#a89c8e"/>`;
txt(0.75, 26.1, '⑨', { size: 13, bold: true });
txt(7.5, 33.4, 'CALLE', { bold: true, size: 14, color: '#555' });

// Cotas
for (const [a, b] of [[0, 2], [2, 8], [8, 12], [12, 16], [16, 19], [19, 26], [26, 32]]) {
  line(-0.5, a, -0.5, b);
  line(-0.7, a, -0.3, a);
  txt(-0.75, (a + b) / 2 + 0.15, String(b - a), { size: 11, anchor: 'end', color: '#444' });
}
line(-0.7, 32, -0.3, 32);
line(0, -0.6, 15, -0.6);
for (const v of [0, 1, 6.5, 15]) line(v, -0.8, v, -0.4);
txt(0.5, -0.8, '1', { size: 11 }); txt(3.75, -0.8, 'casa 5,50', { size: 11 }); txt(10.75, -0.8, '8,50', { size: 11 });
txt(7.5, -1.5, 'Terreno 15 × 32 m · lotes E10-45 + E11-46', { size: 13, bold: true });

// Panel lateral
const PX = 16.3; let py = -1.4;
const pl = (t, o = {}) => { txt(PX, py, t, { anchor: 'start', size: o.size || 12.5, color: o.color, bold: o.bold }); py += o.gap || 0.55; };
pl(`Casa Cesar versión 4 · croquis ${N}`, { bold: true, size: 16, gap: 0.65 });
pl('Planta baja, vista desde arriba · la calle abajo', { color: C.gris, gap: 1.0 });
pl('Decidido', { bold: true });
['Jardín intermedio 7 × 3, descubierto', 'Lavado en el jardín intermedio', 'Pasillo 0,80: 0,40 techado + 0,40 abierto', 'Hab. 2 y 3: vestidor pequeño + baño,', '§una sola entrada desde el dormitorio', 'Escalera en U (opción C), techo alto', 'Alacena de la cocina bajo la escalera', 'Baño social en la esquina de la cocina', 'Terreno 15 × 32: casa a 1 m del lado', '§izquierdo, el lado derecho es jardín', 'Seto 0,20 × 1,30: izquierda y fondo', '⑫ Servicio por el lateral, a la cocina', '⑪ Terraza junto a la doble altura'].forEach((t) => pl(t.startsWith('§') ? '    ' + t.slice(1) : '✓ ' + t, { color: '#3d6b2e' }));
py += 0.4; pl('Por definir', { bold: true, color: C.pend });
['Uso y tamaño de la terraza', 'Escalera: huellas cortas (≈21 cm)', 'Diseño del jardín derecho', 'Puerta principal y fachada'].forEach((t) => pl('• ' + t, { color: C.pend }));
py += 0.4; pl('Medidas en metros. Esquema, no plano', { color: C.gris, size: 11, gap: 0.45 }); pl('constructivo.', { color: C.gris, size: 11 });

const W = X(25.6), H = Y(34);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Roboto, Segoe UI, Arial"><defs><marker id="fl" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="${C.muro}"/></marker></defs><rect width="100%" height="100%" fill="#fff"/>${s}</svg>`;
writeFileSync(join(here, `croquis-${N}.svg`), svg);
const { chromium } = await import(pathToFileURL(join(root, 'node_modules/playwright/index.mjs')).href);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: Math.ceil(W), height: Math.ceil(H) }, deviceScaleFactor: 2 });
await p.setContent(`<body style="margin:0">${svg}</body>`);
await p.screenshot({ path: join(here, `croquis-${N}.png`) });
await b.close();
console.log('ok', W, H);
