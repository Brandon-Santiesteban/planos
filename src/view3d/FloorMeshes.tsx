import { useMemo } from 'react';
import * as THREE from 'three';
import { add, dist, lerp, normalize, scale, sub } from '../geometry/vec';
import { isEndConnected, wallLength } from '../geometry/walls';
import type { Floor, Room, Vec2, Wall } from '../model/types';
import { usePalette } from './palette';
import { edgeTouchesWall, wallPieces } from './wallPieces';

const RAIL_HEIGHT = 1.0;

/** Rotation about Y that aligns local +X with the plan direction d (plan y = world z). */
const yaw = (d: Vec2) => -Math.atan2(d.y, d.x);

function WallMesh({ wall, floor, selected }: { wall: Wall; floor: Floor; selected: boolean }) {
  const pal = usePalette();
  const length = wallLength(wall);
  const d = normalize(sub(wall.b, wall.a));
  const height = wall.height ?? floor.height;
  const half = wall.thickness / 2;
  const openings = floor.openings.filter((o) => o.wallId === wall.id);
  const pieces = wallPieces(
    length,
    height,
    openings,
    isEndConnected(floor.walls, wall.id, 'a') ? half : 0,
    isEndConnected(floor.walls, wall.id, 'b') ? half : 0,
  );
  const rot = yaw(d);
  return (
    <group>
      {pieces.map((p, i) => {
        const c = add(wall.a, scale(d, (p.u0 + p.u1) / 2));
        return (
          <mesh key={i} position={[c.x, (p.z0 + p.z1) / 2, c.y]} rotation={[0, rot, 0]} castShadow receiveShadow>
            <boxGeometry args={[p.u1 - p.u0, p.z1 - p.z0, wall.thickness]} />
            <meshStandardMaterial color={selected ? pal.selected : pal.wall} roughness={0.9} />
          </mesh>
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

function Railing({ a, b }: { a: Vec2; b: Vec2 }) {
  const pal = usePalette();
  const length = dist(a, b);
  const d = normalize(sub(b, a));
  const mid = lerp(a, b, 0.5);
  const rot = yaw(d);
  const posts = Math.max(2, Math.ceil(length) + 1);
  return (
    <group>
      <mesh position={[mid.x, RAIL_HEIGHT, mid.y]} rotation={[0, rot, 0]} castShadow>
        <boxGeometry args={[length, 0.05, 0.06]} />
        <meshStandardMaterial color={pal.rail} metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[mid.x, RAIL_HEIGHT / 2, mid.y]} rotation={[0, rot, 0]}>
        <boxGeometry args={[length, RAIL_HEIGHT - 0.05, 0.015]} />
        <meshPhysicalMaterial color="#cfe8f5" transparent opacity={0.25} roughness={0.1} />
      </mesh>
      {Array.from({ length: posts }, (_, i) => {
        const p = lerp(a, b, i / (posts - 1));
        return (
          <mesh key={i} position={[p.x, RAIL_HEIGHT / 2, p.y]} castShadow>
            <boxGeometry args={[0.04, RAIL_HEIGHT, 0.04]} />
            <meshStandardMaterial color={pal.rail} metalness={0.6} roughness={0.4} />
          </mesh>
        );
      })}
    </group>
  );
}

function RoomSlab({ room, walls, selected }: { room: Room; walls: Wall[]; selected: boolean }) {
  const pal = usePalette();
  const geometry = useMemo(() => {
    const shape = new THREE.Shape(room.points.map((p) => new THREE.Vector2(p.x, p.y)));
    return new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
  }, [room.points]);
  const color = selected ? pal.selected : room.kind === 'balcony' ? pal.balcony : pal.room;
  const edges: [Vec2, Vec2][] = room.points.map((p, i) => [p, room.points[(i + 1) % room.points.length]]);
  return (
    <group>
      {/* Shape is in plan XY; +90° about X maps plan y to world z and extrudes downwards. */}
      <mesh geometry={geometry} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      {room.kind === 'balcony' &&
        edges.filter((e) => !edgeTouchesWall(e, walls)).map((e, i) => <Railing key={i} a={e[0]} b={e[1]} />)}
    </group>
  );
}

export default function FloorMeshes({ floor, elevation, selectedId }: { floor: Floor; elevation: number; selectedId: string | null }) {
  return (
    <group position={[0, elevation, 0]}>
      {floor.rooms.map((r) => <RoomSlab key={r.id} room={r} walls={floor.walls} selected={r.id === selectedId} />)}
      {floor.walls.map((w) => <WallMesh key={w.id} wall={w} floor={floor} selected={w.id === selectedId} />)}
    </group>
  );
}
