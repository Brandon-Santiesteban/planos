import type { FloorMaterial, WallFinish, WallSide } from '../model/types';
import { normalizeHex } from './colors';

/**
 * A procedural material: `tile` is the real size in metres one texture repeat covers (width, height),
 * so bricks stay brick-sized on any wall. `chip` is a representative colour for pickers.
 */
export interface MaterialDef {
  label: string;
  tile: [number, number];
  chip: string;
  roughness: number;
}

export const WALL_FINISH_ORDER: WallFinish[] = ['pintura', 'ladrillo', 'piedra', 'madera', 'enchape'];

export const WALL_FINISHES: Record<WallFinish, MaterialDef> = {
  pintura: { label: 'Pintura', tile: [1, 1], chip: '#F4F1EA', roughness: 0.9 },
  // 4 bricks of 24 cm + 1 cm joint per course, 6 courses of 7 cm + 1 cm.
  ladrillo: { label: 'Ladrillo', tile: [1, 0.48], chip: '#A4553A', roughness: 0.95 },
  piedra: { label: 'Piedra', tile: [1.2, 1.2], chip: '#9C9285', roughness: 0.95 },
  // Vertical boards 12 cm wide.
  madera: { label: 'Madera', tile: [0.6, 1.2], chip: '#9A6B43', roughness: 0.75 },
  // 30 × 30 cm tiles, 2 × 2 per repeat.
  enchape: { label: 'Enchape', tile: [0.6, 0.6], chip: '#E6E9EC', roughness: 0.35 },
};

export const FLOOR_MATERIAL_ORDER: FloorMaterial[] = ['ceramica', 'porcelanato', 'madera', 'concreto', 'piedra', 'cesped'];

export const FLOOR_MATERIALS: Record<FloorMaterial, MaterialDef> = {
  // 45 × 45 cm tiles.
  ceramica: { label: 'Cerámica', tile: [0.9, 0.9], chip: '#D9CFC1', roughness: 0.45 },
  // Large 60 × 60 cm light tiles.
  porcelanato: { label: 'Porcelanato', tile: [1.2, 1.2], chip: '#ECEAE5', roughness: 0.25 },
  // Planks 15 cm × 1,2 m, staggered.
  madera: { label: 'Madera', tile: [1.2, 0.9], chip: '#A87A4F', roughness: 0.6 },
  concreto: { label: 'Concreto', tile: [2, 2], chip: '#A9A8A3', roughness: 0.9 },
  piedra: { label: 'Piedra', tile: [1.2, 1.2], chip: '#A39A8C', roughness: 0.95 },
  cesped: { label: 'Césped', tile: [1, 1], chip: '#6E8A58', roughness: 1 },
};

/** What a face looks like: finish and colour (paint colour, or a tint for the textured finishes; white = natural). */
export function resolveWallSide(side: WallSide | undefined, fallbackPaint: string): { finish: WallFinish; color: string } {
  const finish = side?.finish ?? 'pintura';
  const color = (side?.color && normalizeHex(side.color)) || (finish === 'pintura' ? fallbackPaint : '#FFFFFF');
  return { finish, color };
}
