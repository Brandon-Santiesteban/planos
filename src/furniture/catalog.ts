// Furniture catalog: plain data. To add a piece, add an entry here (and, for a new shape, a builder in meshes.tsx
// and a symbol in symbols.tsx; pieces with an existing `model` need no code at all).
// Sizes in metres. Local axes: width along x, depth along y; the FRONT of a piece faces +y (towards the viewer at
// rotation 0), so a desk at rotation 0 has its back at −y and you sit at +y.

export const CATEGORIES = [
  'Dormitorio', 'Sala', 'Comedor', 'Cocina', 'Baño', 'Oficina y setup', 'Lavandería', 'Exterior', 'Rooftop', 'Parqueadero',
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Which parametric 3D builder / 2D symbol draws the piece. */
export type FurnitureModel =
  | 'cama' | 'mesaNoche' | 'closet' | 'comoda' | 'escritorio' | 'escritorioL' | 'sillaOficina' | 'sillaGamer'
  | 'monitor' | 'torre' | 'tablero' | 'estanteria' | 'lampara' | 'sofa' | 'sofaL' | 'sillon' | 'mesaCentro'
  | 'muebleTV' | 'televisor' | 'alfombra' | 'mesa' | 'silla' | 'meson' | 'estufa' | 'nevera' | 'lavaplatos'
  | 'alacena' | 'sanitario' | 'lavamanos' | 'ducha' | 'banera' | 'espejo' | 'lavadero' | 'lavadora' | 'matera'
  | 'banca' | 'carro' | 'moto' | 'piscina' | 'asoleadora' | 'sombrilla' | 'pergola' | 'bar' | 'parrilla'
  | 'jardinera' | 'arbol' | 'poste';

export interface CatalogItem {
  id: string;
  name: string;
  category: Category;
  width: number;
  depth: number;
  height: number;
  /** height of its base above the floor (wall-mounted pieces, a monitor on a desk) */
  elevation: number;
  color: string;
  model: FurnitureModel;
  /** extra numbers for the builder (e.g. seats of a table) */
  seats?: number;
  /** a double basin, a queen bed with two pillows… */
  double?: boolean;
  /** placed over another piece, it sits on top of it (a monitor on a desk) */
  onTop?: boolean;
  /** tables: the chairs come with it (drawn around it in 2D and 3D) */
  withChairs?: boolean;
}

const item = (
  id: string, name: string, category: Category, model: FurnitureModel,
  [width, depth, height]: [number, number, number], color: string, extra: Partial<CatalogItem> = {},
): CatalogItem => ({ id, name, category, model, width, depth, height, elevation: 0, color, ...extra });

// Warm, neutral colours: wood, linen, greys.
const ROBLE = '#b08a63';
const NOGAL = '#7a5a3f';
const LINO = '#d9cfc0';
const GRIS = '#8d939b';
const GRAFITO = '#3b3f45';
const BLANCO = '#eeebe5';
const LOZA = '#f3f3f0';
const ACERO = '#b9bdc2';

export const CATALOG: CatalogItem[] = [
  // Dormitorio
  item('cama-doble', 'Cama doble', 'Dormitorio', 'cama', [1.4, 1.9, 1.0], LINO, { double: true }),
  item('cama-queen', 'Cama queen', 'Dormitorio', 'cama', [1.6, 2.0, 1.05], LINO, { double: true }),
  item('cama-sencilla', 'Cama sencilla', 'Dormitorio', 'cama', [1.0, 1.9, 0.95], LINO),
  item('mesa-noche', 'Mesa de noche', 'Dormitorio', 'mesaNoche', [0.45, 0.4, 0.55], ROBLE),
  item('closet', 'Clóset', 'Dormitorio', 'closet', [1.2, 0.6, 2.2], BLANCO),
  item('comoda', 'Cómoda', 'Dormitorio', 'comoda', [1.0, 0.45, 0.85], ROBLE),
  // Sala
  item('sofa-3', 'Sofá 3 puestos', 'Sala', 'sofa', [2.1, 0.9, 0.85], GRIS),
  item('sofa-l', 'Sofá en L', 'Sala', 'sofaL', [2.6, 1.6, 0.85], GRIS),
  item('sillon', 'Sillón', 'Sala', 'sillon', [0.85, 0.85, 0.85], '#a78b6d'),
  item('mesa-centro', 'Mesa de centro', 'Sala', 'mesaCentro', [1.1, 0.6, 0.42], NOGAL),
  item('mueble-tv', 'Mueble de TV', 'Sala', 'muebleTV', [1.6, 0.4, 0.5], NOGAL),
  item('televisor', 'Televisor 55"', 'Sala', 'televisor', [1.23, 0.08, 0.72], '#1d1f22', { elevation: 0.5, onTop: true }),
  item('alfombra', 'Alfombra', 'Sala', 'alfombra', [2.0, 1.4, 0.01], '#c9b79c'),
  item('lampara-pie', 'Lámpara de pie', 'Sala', 'lampara', [0.35, 0.35, 1.6], '#e9dcc3'),
  // Comedor
  item('mesa-comedor-4', 'Mesa de comedor 4 puestos', 'Comedor', 'mesa', [1.2, 0.8, 0.75], ROBLE, { seats: 4 }),
  item('mesa-comedor-6', 'Mesa de comedor 6 puestos', 'Comedor', 'mesa', [1.8, 0.9, 0.75], ROBLE, { seats: 6 }),
  item('silla-comedor', 'Silla de comedor', 'Comedor', 'silla', [0.45, 0.5, 0.9], NOGAL),
  // Cocina
  item('meson', 'Mesón de cocina', 'Cocina', 'meson', [1.2, 0.6, 0.9], BLANCO),
  item('lavaplatos', 'Lavaplatos (mesón con poceta)', 'Cocina', 'lavaplatos', [0.8, 0.6, 0.9], BLANCO),
  item('estufa', 'Estufa', 'Cocina', 'estufa', [0.6, 0.6, 0.9], ACERO),
  item('nevera', 'Nevera', 'Cocina', 'nevera', [0.7, 0.7, 1.8], ACERO),
  item('alacena', 'Alacena alta', 'Cocina', 'alacena', [1.2, 0.35, 0.7], BLANCO, { elevation: 1.5 }),
  // Baño
  item('sanitario', 'Sanitario', 'Baño', 'sanitario', [0.4, 0.7, 0.78], LOZA),
  item('lavamanos', 'Lavamanos', 'Baño', 'lavamanos', [0.6, 0.45, 0.85], LOZA),
  item('lavamanos-doble', 'Lavamanos doble', 'Baño', 'lavamanos', [1.2, 0.5, 0.85], LOZA, { double: true }),
  item('ducha', 'Ducha', 'Baño', 'ducha', [0.9, 0.9, 2.0], '#cfd8dc'),
  item('banera', 'Bañera', 'Baño', 'banera', [1.7, 0.75, 0.55], LOZA),
  item('espejo', 'Espejo', 'Baño', 'espejo', [0.8, 0.03, 0.9], '#cfdde6', { elevation: 1.1 }),
  // Oficina y setup
  item('escritorio', 'Escritorio', 'Oficina y setup', 'escritorio', [1.4, 0.7, 0.75], ROBLE),
  item('escritorio-l', 'Escritorio en L', 'Oficina y setup', 'escritorioL', [1.6, 1.4, 0.75], ROBLE),
  item('silla-oficina', 'Silla de oficina', 'Oficina y setup', 'sillaOficina', [0.62, 0.62, 1.1], GRAFITO),
  item('silla-gamer', 'Silla gamer', 'Oficina y setup', 'sillaGamer', [0.7, 0.7, 1.35], '#2b2d31'),
  item('monitor', 'Monitor 27"', 'Oficina y setup', 'monitor', [0.61, 0.2, 0.45], '#1d1f22', { elevation: 0.75, onTop: true }),
  item('torre-pc', 'Torre de PC', 'Oficina y setup', 'torre', [0.22, 0.48, 0.48], '#25272b', { onTop: true }),
  item('tablero-blanco', 'Tablero blanco', 'Oficina y setup', 'tablero', [1.2, 0.03, 0.9], '#fbfbf9', { elevation: 0.9 }),
  item('estanteria', 'Estantería', 'Oficina y setup', 'estanteria', [0.8, 0.35, 1.8], ROBLE),
  // Lavandería
  item('lavadero', 'Lavadero', 'Lavandería', 'lavadero', [0.7, 0.6, 0.85], '#c9c6c0'),
  item('lavadora', 'Lavadora', 'Lavandería', 'lavadora', [0.6, 0.65, 0.95], LOZA),
  // Exterior
  item('matera', 'Matera con planta', 'Exterior', 'matera', [0.45, 0.45, 1.0], '#a0522d'),
  item('banca', 'Banca de exterior', 'Exterior', 'banca', [1.2, 0.45, 0.45], '#9a7650'),
  // Street trees: colour = crown. Guayacán amarillo flowers yellow; the small one is a green crown.
  item('arbol-guayacan', 'Árbol guayacán amarillo', 'Exterior', 'arbol', [3.0, 3.0, 6.0], '#e3b42b'),
  item('arbol-pequeno', 'Árbol pequeño', 'Exterior', 'arbol', [2.0, 2.0, 3.5], '#5f8a3e'),
  item('arbusto', 'Arbusto', 'Exterior', 'arbol', [1.0, 1.0, 1.0], '#557a38'),
  item('poste-alumbrado', 'Poste de alumbrado', 'Exterior', 'poste', [0.3, 1.2, 6.0], '#3b3f45'),
  // Rooftop
  item('piscina', 'Piscina elevada', 'Rooftop', 'piscina', [3.0, 2.4, 1.1], '#eae6df'),
  item('asoleadora', 'Asoleadora', 'Rooftop', 'asoleadora', [0.7, 1.95, 0.85], '#e8e2d6'),
  item('sombrilla', 'Sombrilla', 'Rooftop', 'sombrilla', [2.5, 2.5, 2.4], '#e6dccb'),
  item('pergola', 'Pérgola', 'Rooftop', 'pergola', [3.0, 3.0, 2.4], '#8a6a4b'),
  item('sofa-exterior', 'Sofá de exterior', 'Rooftop', 'sofa', [2.0, 0.85, 0.75], '#cfc6b6'),
  item('mesa-exterior', 'Mesa de exterior con sillas', 'Rooftop', 'mesa', [1.2, 0.8, 0.74], '#9a7650', { seats: 4, withChairs: true }),
  item('silla-exterior', 'Silla de exterior', 'Rooftop', 'silla', [0.5, 0.55, 0.85], '#9a7650'),
  item('bar', 'Barra con taburetes', 'Rooftop', 'bar', [2.0, 0.6, 1.05], '#7a5a3f', { seats: 3 }),
  item('parrilla', 'Parrilla (BBQ)', 'Rooftop', 'parrilla', [1.2, 0.6, 1.0], '#3b3f45'),
  item('jardinera', 'Jardinera larga', 'Rooftop', 'jardinera', [1.8, 0.4, 0.6], '#9b9188'),
  item('matera-alta', 'Matera alta', 'Rooftop', 'matera', [0.45, 0.45, 1.6], '#6b625b'),
  // Parqueadero (length along the width: the nose of a vehicle points to +x)
  item('carro', 'Carro (sedán)', 'Parqueadero', 'carro', [4.5, 1.8, 1.45], '#5d6d7e'),
  item('moto', 'Moto', 'Parqueadero', 'moto', [2.0, 0.75, 1.1], '#7b2d26'),
];

const byId = new Map(CATALOG.map((i) => [i.id, i]));

export function catalogItem(id: string): CatalogItem | undefined {
  return byId.get(id);
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Items whose name contains every word of `query` (accents and case ignored), optionally in one category. */
export function searchCatalog(query: string, category?: Category | null): CatalogItem[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  return CATALOG.filter(
    (i) => (!category || i.category === category) && words.every((w) => fold(i.name).includes(w)),
  );
}
