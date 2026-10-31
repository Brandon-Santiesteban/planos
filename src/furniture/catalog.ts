// Furniture catalog: plain data. To add a piece, add an entry here (and, for a new shape, a builder in meshes.tsx
// and a symbol in symbols.tsx; pieces with an existing `model` need no code at all).
// Sizes in metres. Local axes: width along x, depth along y; the FRONT of a piece faces +y (towards the viewer at
// rotation 0), so a desk at rotation 0 has its back at −y and you sit at +y.

export const CATEGORIES = [
  'Dormitorio', 'Sala', 'Comedor', 'Cocina', 'Baño', 'Oficina y setup', 'Decoración', 'Iluminación', 'Lavandería', 'Exterior', 'Rooftop',
  'Parqueadero',
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Which parametric 3D builder / 2D symbol draws the piece. */
export type FurnitureModel =
  | 'cama' | 'mesaNoche' | 'closet' | 'comoda' | 'escritorio' | 'escritorioL' | 'sillaOficina' | 'sillaGamer'
  | 'monitor' | 'torre' | 'tablero' | 'estanteria' | 'lampara' | 'sofa' | 'sofaL' | 'sillon' | 'mesaCentro'
  | 'muebleTV' | 'televisor' | 'alfombra' | 'mesa' | 'silla' | 'meson' | 'estufa' | 'nevera' | 'lavaplatos'
  | 'alacena' | 'sanitario' | 'lavamanos' | 'ducha' | 'banera' | 'espejo' | 'lavadero' | 'lavadora' | 'matera'
  | 'banca' | 'carro' | 'moto' | 'piscina' | 'asoleadora' | 'sombrilla' | 'pergola' | 'bar' | 'parrilla'
  | 'jardinera' | 'arbol' | 'poste' | 'centroEntretenimiento' | 'cortina' | 'tiraLed' | 'cuadro' | 'repisa'
  | 'consola' | 'jacuzzi' | 'toallero' | 'brasero' | 'puf' | 'jardinVertical' | 'porton' | 'vestier'
  | 'luzEmpotrada' | 'colgante' | 'aplique' | 'aire' | 'canasta' | 'centroEscritorio' | 'impresora'
  | 'matita' | 'monstera' | 'plantaColgante' | 'pampas' | 'adornos' | 'repisaDeco';

/** Open walk-in dressing modules (model 'vestier'): what each one holds. */
export type Dressing = 'colgar' | 'repisas' | 'zapatos' | 'cajones';

/** Artwork of a framed picture (model 'cuadro'). */
export type Art = 'paisaje' | 'abstracto' | 'byn' | 'gamer';

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
  /** framed pictures: what the artwork shows (the colour is the frame) */
  art?: Art;
  /** trees: colour of the (sparse) flowers in the crown */
  flowers?: string;
  /** walk-in dressing modules: hanging rail, shelves, shoe rack or drawers */
  dressing?: Dressing;
  /** chests of drawers: a framed mirror standing on top, the chest itself this tall (the rest is the mirror) */
  mirrorAbove?: number;
  /** light fittings: it lights the room in 3D, from this height of the piece (0 bottom … 1 top), warm white */
  light?: number;
}

const item = (
  id: string, name: string, category: Category, model: FurnitureModel,
  [width, depth, height]: [number, number, number], color: string, extra: Partial<CatalogItem> = {},
): CatalogItem => ({ id, name, category, model, width, depth, height, elevation: 0, color, ...extra });

// Warm, neutral colours: wood, linen, greys.
const ROBLE = '#b08a63';
const NOGAL = '#7a5a3f';
const NOGAL_CLARO = '#9a6f4b';
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
  item('cama-king', 'Cama king', 'Dormitorio', 'cama', [2.0, 2.0, 1.05], LINO, { double: true }),
  item('cama-sencilla', 'Cama sencilla', 'Dormitorio', 'cama', [1.0, 1.9, 0.95], LINO),
  item('mesa-noche', 'Mesa de noche', 'Dormitorio', 'mesaNoche', [0.45, 0.4, 0.55], ROBLE),
  item('closet', 'Clóset', 'Dormitorio', 'closet', [1.2, 0.6, 2.2], BLANCO),
  item('vestier-colgar', 'Vestier: módulo para colgar', 'Dormitorio', 'vestier', [1.0, 0.55, 2.4], NOGAL_CLARO, { dressing: 'colgar' }),
  item('vestier-repisas', 'Vestier: repisas', 'Dormitorio', 'vestier', [0.7, 0.55, 2.4], NOGAL_CLARO, { dressing: 'repisas' }),
  item('vestier-zapatos', 'Vestier: zapatero y bolsos', 'Dormitorio', 'vestier', [0.7, 0.55, 2.4], NOGAL_CLARO, { dressing: 'zapatos' }),
  item('vestier-cajones', 'Vestier: cajonera con repisas', 'Dormitorio', 'vestier', [1.0, 0.55, 2.4], NOGAL_CLARO, { dressing: 'cajones' }),
  item('comoda', 'Cómoda', 'Dormitorio', 'comoda', [1.0, 0.45, 0.85], ROBLE),
  item('comoda-6', 'Cómoda de 6 cajones', 'Dormitorio', 'comoda', [1.5, 0.48, 0.85], NOGAL_CLARO),
  item('semanario', 'Semanario (cómoda alta)', 'Dormitorio', 'comoda', [0.6, 0.45, 1.3], ROBLE),
  item('comoda-espejo', 'Cómoda con espejo', 'Dormitorio', 'comoda', [1.2, 0.45, 1.75], BLANCO, { mirrorAbove: 0.85 }),
  // Sala
  item('sofa-3', 'Sofá 3 puestos', 'Sala', 'sofa', [2.1, 0.9, 0.85], GRIS),
  item('sofa-l', 'Sofá en L', 'Sala', 'sofaL', [2.6, 1.6, 0.85], GRIS),
  item('sillon', 'Sillón', 'Sala', 'sillon', [0.85, 0.85, 0.85], '#a78b6d'),
  item('mesa-centro', 'Mesa de centro', 'Sala', 'mesaCentro', [1.1, 0.6, 0.42], NOGAL),
  item('mueble-tv', 'Mueble de TV', 'Sala', 'muebleTV', [1.6, 0.4, 0.5], NOGAL),
  item('televisor', 'Televisor 55"', 'Sala', 'televisor', [1.23, 0.08, 0.72], '#1d1f22', { elevation: 0.5, onTop: true }),
  item('televisor-70', 'Televisor 70" (de pared)', 'Sala', 'televisor', [1.56, 0.06, 0.9], '#1d1f22', { elevation: 0.95 }),
  item('alfombra', 'Alfombra', 'Sala', 'alfombra', [2.0, 1.4, 0.01], '#c9b79c'),
  item('lampara-pie', 'Lámpara de pie', 'Sala', 'lampara', [0.35, 0.35, 1.6], '#e9dcc3', { light: 0.9 }),
  // Wall unit: low cabinet, two shelf towers, a bridge shelf on top and a niche for the TV (a separate piece).
  item('centro-entretenimiento', 'Centro de entretenimiento', 'Sala', 'centroEntretenimiento', [2.4, 0.45, 1.9], NOGAL),
  item('consola', 'Consola de videojuegos', 'Sala', 'consola', [0.39, 0.26, 0.1], '#f2f2f0', { elevation: 0.5, onTop: true }),
  // Iluminación: they light the 3D view (most noticeable in the evening and at night).
  item('luz-empotrada', 'Luz empotrada (techo)', 'Iluminación', 'luzEmpotrada', [0.1, 0.1, 0.02], '#f4f1ea', { elevation: 2.58, light: 0 }),
  item('lampara-colgante', 'Lámpara colgante', 'Iluminación', 'colgante', [0.35, 0.35, 0.9], '#2f2b28', { elevation: 1.7, light: 0.05 }),
  item('aplique-pared', 'Aplique de pared', 'Iluminación', 'aplique', [0.16, 0.14, 0.28], '#d9c8a8', { elevation: 1.7, light: 0.5 }),
  item('tira-led-calida', 'Tira LED cálida (luz indirecta)', 'Iluminación', 'tiraLed', [1.0, 0.02, 0.02], '#ffd29a', { elevation: 2.4, light: 0.5 }),
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
  item('ducha', 'Ducha tipo lluvia (sin puerta)', 'Baño', 'ducha', [0.9, 0.9, 2.1], '#cfd8dc'),
  item('banera', 'Bañera', 'Baño', 'banera', [1.7, 0.75, 0.55], LOZA),
  item('jacuzzi', 'Jacuzzi', 'Baño', 'jacuzzi', [1.7, 0.8, 0.55], LOZA),
  // Mirrors: a light, slightly bluish silver (never a dark screen).
  item('espejo', 'Espejo', 'Baño', 'espejo', [0.8, 0.03, 0.9], '#dfe7ee', { elevation: 1.1 }),
  item('toallero', 'Toallero con toallas', 'Baño', 'toallero', [0.6, 0.12, 0.5], '#e8e1d4', { elevation: 0.9 }),
  // Oficina y setup
  item('escritorio', 'Escritorio', 'Oficina y setup', 'escritorio', [1.4, 0.7, 0.75], ROBLE),
  item('escritorio-l', 'Escritorio en L', 'Oficina y setup', 'escritorioL', [1.6, 1.4, 0.75], ROBLE),
  item('silla-oficina', 'Silla de oficina', 'Oficina y setup', 'sillaOficina', [0.62, 0.62, 1.1], GRAFITO),
  item('silla-gamer', 'Silla gamer', 'Oficina y setup', 'sillaGamer', [0.7, 0.7, 1.35], '#2b2d31'),
  item('monitor', 'Monitor 27"', 'Oficina y setup', 'monitor', [0.61, 0.2, 0.45], '#1d1f22', { elevation: 0.75, onTop: true }),
  item('torre-pc', 'Torre de PC', 'Oficina y setup', 'torre', [0.22, 0.48, 0.48], '#25272b', { onTop: true }),
  item('tablero-blanco', 'Tablero blanco', 'Oficina y setup', 'tablero', [1.2, 0.03, 0.9], '#fbfbf9', { elevation: 0.9 }),
  item('estanteria', 'Estantería', 'Oficina y setup', 'estanteria', [0.8, 0.35, 1.8], ROBLE),
  // A thin glowing strip; its colour is the light's colour.
  item('tira-led', 'Tira LED neón (color a elegir)', 'Oficina y setup', 'tiraLed', [1.0, 0.02, 0.02], '#8a5cff', { elevation: 1.0, light: 0.5 }),
  item('impresora', 'Impresora', 'Oficina y setup', 'impresora', [0.42, 0.36, 0.22], '#e9e9e6', { elevation: 0.75, onTop: true }),
  item('centro-escritorio', 'Centro de entretenimiento con escritorio', 'Oficina y setup', 'centroEscritorio', [2.15, 0.8, 2.2], NOGAL),
  item('poster-gamer', 'Póster gamer', 'Oficina y setup', 'cuadro', [0.6, 0.02, 0.85], '#15161a', { elevation: 1.07, art: 'gamer' }),
  // Decoración (wall pieces hang with their centre at about 1,5 m)
  item('cuadro-paisaje', 'Cuadro paisaje', 'Decoración', 'cuadro', [1.0, 0.04, 0.7], '#e9e4da', { elevation: 1.15, art: 'paisaje' }),
  item('cuadro-abstracto', 'Cuadro abstracto cálido', 'Decoración', 'cuadro', [0.8, 0.04, 0.8], '#2b2622', { elevation: 1.1, art: 'abstracto' }),
  item('cuadro-byn', 'Cuadro blanco y negro', 'Decoración', 'cuadro', [0.5, 0.04, 0.7], '#1e1e1e', { elevation: 1.15, art: 'byn' }),
  item('espejo-cuerpo', 'Espejo de cuerpo entero', 'Decoración', 'espejo', [0.6, 0.05, 1.7], '#dfe7ee', { elevation: 0.25 }),
  item('cortina', 'Cortina', 'Decoración', 'cortina', [1.2, 0.08, 2.4], '#d8cdbb'),
  item('aire-acondicionado', 'Aire acondicionado (minisplit)', 'Dormitorio', 'aire', [0.9, 0.23, 0.3], '#f4f4f2', { elevation: 2.1 }),
  item('repisa-decorativa', 'Repisas decorativas (libros, plantas, velas)', 'Decoración', 'repisaDeco', [0.8, 0.22, 0.6], '#8a6446', { elevation: 1.2 }),
  item('matita', 'Matita (planta pequeña)', 'Decoración', 'matita', [0.14, 0.14, 0.24], '#e9e4da', { onTop: true }),
  item('monstera', 'Planta monstera (de piso)', 'Decoración', 'monstera', [0.7, 0.7, 1.2], '#c9b18a'),
  item('planta-colgante', 'Planta colgante (macramé)', 'Decoración', 'plantaColgante', [0.4, 0.4, 0.9], '#e9e4da', { elevation: 1.7 }),
  item('jarron-pampas', 'Jarrón con pampas', 'Decoración', 'pampas', [0.25, 0.25, 0.9], '#d9cbb3'),
  item('adornos-mesa', 'Adornos de mesa (libros, vela, matita)', 'Decoración', 'adornos', [0.35, 0.2, 0.25], '#c87a55', { onTop: true }),
  item('repisa-coleccionables', 'Repisa con coleccionables', 'Decoración', 'repisa', [1.0, 0.25, 0.6], '#2e3036', { elevation: 1.45 }),
  // Lavandería
  item('lavadero', 'Lavadero', 'Lavandería', 'lavadero', [0.7, 0.6, 0.85], '#c9c6c0'),
  item('lavadora', 'Lavadora', 'Lavandería', 'lavadora', [0.6, 0.65, 0.95], LOZA),
  item('canasta-ropa', 'Canasta de ropa sucia', 'Lavandería', 'canasta', [0.42, 0.42, 0.6], '#b8935f'),
  // Exterior
  item('matera', 'Matera con planta', 'Exterior', 'matera', [0.45, 0.45, 1.0], '#a0522d'),
  item('banca', 'Banca de exterior', 'Exterior', 'banca', [1.2, 0.45, 0.45], '#9a7650'),
  // Street trees: colour = foliage (each tree varies it a little). The guayacán is mostly green with a few
  // muted yellow flowers.
  item('arbol-guayacan', 'Árbol guayacán amarillo', 'Exterior', 'arbol', [3.0, 3.0, 6.0], '#6a8c42', { flowers: '#e0c552' }),
  item('arbol-pequeno', 'Árbol pequeño', 'Exterior', 'arbol', [2.0, 2.0, 3.5], '#5d8642'),
  item('arbusto', 'Arbusto', 'Exterior', 'arbol', [1.0, 1.0, 1.0], '#557e3c'),
  item('poste-alumbrado', 'Poste de alumbrado', 'Exterior', 'poste', [0.3, 1.2, 6.0], '#3b3f45'),
  // Two leaves on parallel tracks; open, they stack beside the opening (see gate.ts). Same celosía as the front fence.
  item('porton-telescopico', 'Portón corredizo telescópico', 'Parqueadero', 'porton', [3.3, 0.12, 2.0], '#1e1e1e'),
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
  item('brasero', 'Brasero (fogata)', 'Rooftop', 'brasero', [0.8, 0.8, 0.4], '#6e6a64'),
  item('sillon-exterior', 'Sillón de exterior', 'Rooftop', 'sillon', [0.75, 0.75, 0.75], '#cfc6b6'),
  item('puf', 'Puf de exterior', 'Rooftop', 'puf', [0.5, 0.5, 0.4], '#b9764f'),
  item('jardin-vertical', 'Jardín vertical', 'Rooftop', 'jardinVertical', [1.6, 0.12, 1.8], '#4f6f3a', { elevation: 0.2 }),
  // Parqueadero (length along the width: the nose of a vehicle points to +x)
  item('carro', 'Carro (sedán)', 'Parqueadero', 'carro', [4.5, 1.8, 1.45], '#5d6d7e'),
  item('moto', 'Moto', 'Parqueadero', 'moto', [2.0, 0.75, 1.1], '#7b2d26'),
];

const byId = new Map(CATALOG.map((i) => [i.id, i]));

export function catalogItem(id: string): CatalogItem | undefined {
  return byId.get(id);
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Other words people search with, by a word of the piece's name. */
const SYNONYMS: Record<string, string> = {
  televisor: 'tv tele television pantalla smart',
  sofa: 'mueble sala couch',
  comoda: 'cajonera cajones',
  semanario: 'cajonera cajones comoda',
  closet: 'armario ropero guardarropa',
  canasta: 'cesto ropa sucia lavanderia',
  vestier: 'closet armario ropero walk-in',
  sanitario: 'inodoro wc',
  lavamanos: 'lavabo',
  estufa: 'cocina fogon horno',
  nevera: 'refrigerador heladera frigorifico',
  lavaplatos: 'fregadero',
  meson: 'encimera barra',
  ducha: 'regadera',
  banera: 'tina',
  lampara: 'luz',
  tira: 'luz led',
  matera: 'planta maceta',
  matita: 'planta maceta suculenta cactus mata',
  monstera: 'planta maceta mata',
  pampas: 'florero jarron decoracion',
  repisas: 'estante repisa libros',
  adornos: 'decoracion libros vela',
  jardinera: 'planta',
  arbol: 'planta',
  alfombra: 'tapete',
  cuadro: 'arte pintura',
  escritorio: 'mesa trabajo',
  monitor: 'pantalla',
  torre: 'pc computador',
  carro: 'auto coche',
  piscina: 'alberca',
  parrilla: 'asador bbq',
};

/** Name plus the words people may search it by. */
const searchText = (i: CatalogItem) => {
  const name = fold(i.name);
  const extra = Object.entries(SYNONYMS).filter(([w]) => name.includes(w)).map(([, s]) => s);
  return [name, ...extra].join(' ');
};

/**
 * Items whose name, or a usual other word for them («tv» for a televisor), contains every word of `query`
 * (accents and case ignored), optionally in one category.
 */
export function searchCatalog(query: string, category?: Category | null): CatalogItem[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  return CATALOG.filter((i) => {
    if (category && i.category !== category) return false;
    const text = searchText(i);
    return words.every((w) => text.includes(w));
  });
}
