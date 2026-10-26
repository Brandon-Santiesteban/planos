import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { add, dist, lerp, normalize, scale, sub } from '../geometry/vec';
import { wallLength } from '../geometry/walls';
import { resolveWallSide } from '../materials/catalog';
import { floorSurfaceMaterial, plainMaterial, railingMaterial, useMaterialLibrary, wallFaceMaterial } from '../materials/library';
import { railingColors, railingParts } from '../materials/railing';
import { applyMetricUVs, wallEndExtension } from '../materials/wallFaces';
import type { Floor, RailingType, Room, Vec2, Wall } from '../model/types';
import { usePalette } from './palette';
import StairsMesh from './StairsMesh';
import { edgeTouchesWall, wallPieces } from './wallPieces';

/** Rotation about Y that aligns local +X with the plan direction d (plan y = world z). */
const yaw = (d: Vec2) => -Math.atan2(d.y, d.x);

function WallMesh({ wall, floor, selected }: { wall: Wall; floor: Floor; selected: boolean }) {
  const pal = usePalette();
  const length = wallLength(wall);
  const d = normalize(sub(wall.b, wall.a));
  const height = wall.height ?? floor.height;
  const openings = floor.openings.filter((o) => o.wallId === wall.id);
  const pieces = wallPieces(
    length,
    height,
    openings,
    wallEndExtension(floor.walls, wall, 'a'),
    wallEndExtension(floor.walls, wall, 'b'),
  );
  const rot = yaw(d);
  // Boxes with UVs in metres on both faces, so textures keep their real size; rebuilt only when the shape changes.
  const shapeKey = JSON.stringify(pieces) + wall.thickness;
  const geometries = useMemo(
    () => pieces.map((p) => {
      const g = new THREE.BoxGeometry(p.u1 - p.u0, p.z1 - p.z0, wall.thickness);
      applyMetricUVs(g, p);
      return g;
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shapeKey],
  );
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);
  // Box groups: ends, ends, top, bottom, left face (+Z), right face (−Z). Ends and tops stay neutral.
  let faces: THREE.Material[];
  if (selected) {
    faces = Array(6).fill(plainMaterial(pal.selected));
  } else {
    const neutral = plainMaterial(pal.wall);
    const l = resolveWallSide(wall.sides?.left, pal.wall);
    const r = resolveWallSide(wall.sides?.right, pal.wall);
    faces = [neutral, neutral, neutral, neutral, wallFaceMaterial(l.finish, l.color), wallFaceMaterial(r.finish, r.color)];
  }
  return (
    <group>
      {pieces.map((p, i) => {
        const c = add(wall.a, scale(d, (p.u0 + p.u1) / 2));
        return (
          <mesh
            key={i}
            geometry={geometries[i]}
            material={faces}
            position={[c.x, (p.z0 + p.z1) / 2, c.y]}
            rotation={[0, rot, 0]}
            castShadow
            receiveShadow
          />
        );
      })}
      {openings
        .filter((o) => o.kind === 'window')
        .map((o) => {
          const c = add(wall.a, scale(d, o.offset));
          return (
            <mesh key={o.id} position={[c.x, o.sill + o.height / 2, c.y]} rotation={[0, rot, 0]}>
              <boxGeometry args={[o.width, o.height, 0.02]} />
              <meshPhysicalMaterial color="#bfe3ff" transparent opacity={0.3} roughness={0.05} />
            </mesh>
          );
        })}
    </group>
  );
}

/** Railing on an open balcony edge, by kind (railing.ts): glass, solid parapet or slatted celosía. */
function Railing({ a, b, type, color, ground }: { a: Vec2; b: Vec2; type: RailingType | undefined; color: string | undefined; ground: boolean }) {
  const pal = usePalette();
  const length = dist(a, b);
  const d = normalize(sub(b, a));
  const mid = lerp(a, b, 0.5);
  const rot = yaw(d);
  const spec = railingParts(type, ground);
  const posts = spec.posts ? Math.max(2, Math.ceil(length / (type === 'celosia' ? 1.5 : 1)) + 1) : 0;
  const c = railingColors(type, color, pal.wall);
  const colors = { wall: type === 'muro' ? c.band : pal.wall, wood: c.band, metal: c.metal };
  const metal = railingMaterial('metal', colors);
  return (
    <group>
      {spec.parts.map((part, i) => (
        <mesh
          key={i}
          position={[mid.x, (part.z0 + part.z1) / 2, mid.y]}
          rotation={[0, rot, 0]}
          material={railingMaterial(part.material, colors)}
          castShadow={part.material !== 'glass'}
          receiveShadow
        >
          <boxGeometry args={[length, part.z1 - part.z0, part.depth]} />
        </mesh>
      ))}
      {Array.from({ length: posts }, (_, i) => {
        const p = lerp(a, b, i / (posts - 1));
        return (
          <mesh key={`p${i}`} position={[p.x, spec.height / 2, p.y]} rotation={[0, rot, 0]} material={metal} castShadow>
            <boxGeometry args={[0.04, spec.height, 0.04]} />
          </mesh>
        );
      })}
    </group>
  );
}

function RoomSlab({ room, walls, selected, floorHeight, ground }: { room: Room; walls: Wall[]; selected: boolean; floorHeight: number; ground: boolean }) {
  const pal = usePalette();
  const geometry = useMemo(() => {
    const shape = new THREE.Shape(room.points.map((p) => new THREE.Vector2(p.x, p.y)));
    return new THREE.ExtrudeGeometry(shape, { depth: room.kind === 'roof' ? 0.06 : 0.02, bevelEnabled: false });
  }, [room.points, room.kind]);
  if (room.kind === 'stairs') return <StairsMesh room={room} rise={floorHeight} selected={selected} />;
  if (room.kind === 'roof') {
    // A covering only: a thin light sheet at its own height, slightly see-through.
    return (
      <mesh geometry={geometry} rotation={[Math.PI / 2, 0, 0]} position={[0, (room.height ?? floorHeight) + 0.06, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={selected ? pal.selected : '#e8ebef'} roughness={0.6} transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>
    );
  }
  const color = selected ? pal.selected : room.kind === 'balcony' ? pal.balcony : pal.room;
  // The slab's top UVs are plan coordinates in metres, so floor textures keep their real size.
  const surface = !selected && room.floorMaterial ? floorSurfaceMaterial(room.floorMaterial) : null;
  const edges: [Vec2, Vec2][] = room.points.map((p, i) => [p, room.points[(i + 1) % room.points.length]]);
  return (
    <group>
      {/* Shape is in plan XY; +90° about X maps plan y to world z and extrudes downwards. */}
      {surface ? (
        <mesh geometry={geometry} material={surface} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow />
      ) : (
        <mesh geometry={geometry} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
      )}
      {/* Seen from the floor below (walking) the slab is a ceiling: back faces drawn plain. */}
      <mesh geometry={geometry} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <meshStandardMaterial color="#efebe4" roughness={0.9} side={THREE.BackSide} />
      </mesh>
      {room.kind === 'balcony' &&
        edges.filter((e) => !edgeTouchesWall(e, walls)).map((e, i) => (
          <Railing key={i} a={e[0]} b={e[1]} type={room.railing} color={room.railingColor} ground={ground} />
        ))}
    </group>
  );
}

export default function FloorMeshes({ floor, elevation, selectedId }: { floor: Floor; elevation: number; selectedId: string | null }) {
  useMaterialLibrary();
  // Ground floor (elevation 0): a balcony there is a front garden, where a celosía becomes a 2 m fence.
  const ground = elevation <= 1e-6;
  return (
    <group position={[0, elevation, 0]}>
      {floor.rooms.map((r) => <RoomSlab key={r.id} room={r} walls={floor.walls} selected={r.id === selectedId} floorHeight={floor.height} ground={ground} />)}
      {floor.walls.map((w) => <WallMesh key={w.id} wall={w} floor={floor} selected={w.id === selectedId} />)}
    </group>
  );
}
