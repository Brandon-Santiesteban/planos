// Shared 3D materials: one texture per finish and one material per (finish, colour), reused by every wall and slab.
// Everything is disposed when the last 3D view using the library goes away.
import { useEffect } from 'react';
import { DoubleSide, type Material, MeshPhysicalMaterial, MeshStandardMaterial, type Texture } from 'three';
import type { FloorMaterial, WallFinish } from '../model/types';
import { FLOOR_MATERIALS, WALL_FINISHES } from './catalog';
import type { RailingPart } from './railing';
import { makeFloorTexture, makeWallTexture } from './textures';

const textures = new Map<string, Texture>();
const materials = new Map<string, Material>();
let users = 0;

function texture(key: string, make: () => Texture): Texture {
  let t = textures.get(key);
  if (!t) {
    t = make();
    textures.set(key, t);
  }
  return t;
}

function cached<M extends Material>(key: string, make: () => M): M {
  let m = materials.get(key) as M | undefined;
  if (!m) {
    m = make();
    materials.set(key, m);
  }
  return m;
}

export function disposeMaterialLibrary(): void {
  for (const m of materials.values()) m.dispose();
  for (const t of textures.values()) t.dispose();
  materials.clear();
  textures.clear();
}

/** Keeps the library alive while a component using it is mounted. */
export function useMaterialLibrary(): void {
  useEffect(() => {
    users++;
    return () => {
      users--;
      if (users === 0) disposeMaterialLibrary();
    };
  }, []);
}

/** Plain colour (wall ends and tops, selection, railing parts). */
export function plainMaterial(color: string, roughness = 0.9): MeshStandardMaterial {
  return cached(`plain|${color}|${roughness}`, () => new MeshStandardMaterial({ color, roughness }));
}

/** One face of a wall: paint is a flat colour; the other finishes are textured and tinted by `color`. */
export function wallFaceMaterial(finish: WallFinish, color: string): MeshStandardMaterial {
  if (finish === 'pintura') return plainMaterial(color, WALL_FINISHES.pintura.roughness);
  return cached(`wall|${finish}|${color}`, () => new MeshStandardMaterial({
    color,
    map: texture(`wall|${finish}`, () => makeWallTexture(finish)),
    roughness: WALL_FINISHES[finish].roughness,
  }));
}

/** A floor slab; the slab's UVs are plan coordinates in metres. */
export function floorSurfaceMaterial(m: FloorMaterial): MeshStandardMaterial {
  return cached(`floor|${m}`, () => new MeshStandardMaterial({
    color: '#ffffff',
    map: texture(`floor|${m}`, () => makeFloorTexture(m)),
    roughness: FLOOR_MATERIALS[m].roughness,
  }));
}

/** Railing bands: `wall` is the parapet / low wall colour, `wood` the slats, `metal` posts and handrails. */
export function railingMaterial(kind: RailingPart['material'], colors: { wall: string; wood: string; metal: string }): Material {
  switch (kind) {
    case 'glass':
      return cached('rail|glass', () => new MeshPhysicalMaterial({ color: '#cfe8f5', transparent: true, opacity: 0.25, roughness: 0.1, side: DoubleSide }));
    case 'metal':
      return cached(`rail|metal|${colors.metal}`, () => new MeshStandardMaterial({ color: colors.metal, metalness: 0.5, roughness: 0.45 }));
    case 'coping':
      return plainMaterial('#B9B6AF', 0.8);
    case 'wood':
      return plainMaterial(colors.wood, 0.7);
    default:
      return plainMaterial(colors.wall);
  }
}
