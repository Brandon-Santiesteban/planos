import { useMemo } from 'react';
import { Quaternion, Vector3 } from 'three';
import type { Room } from '../model/types';
import { stairDivider, stairFrame, stairSteps, toPlan } from '../walk/stairs';
import { usePalette } from './palette';

const SLAB = 0.35; // each step is a block this deep under its tread, so the flight reads as a stepped slab
const RAIL = 0.9;
const BALUSTER_GAP = 0.25;

const UP = new Vector3(0, 1, 0);

/** A round bar between two world points. */
function Bar({ from, to, radius, color }: { from: Vector3; to: Vector3; radius: number; color: string }) {
  const { mid, length, quat } = useMemo(() => {
    const dir = to.clone().sub(from);
    return {
      mid: from.clone().add(to).multiplyScalar(0.5),
      length: dir.length(),
      quat: new Quaternion().setFromUnitVectors(UP, dir.clone().normalize()),
    };
  }, [from, to]);
  return (
    <mesh position={mid} quaternion={quat} castShadow>
      <cylinderGeometry args={[radius, radius, length, 8]} />
      <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
    </mesh>
  );
}

/** Steps (and the landing of a U stairs) with a simple handrail; U stairs get balusters between the flights. */
export default function StairsMesh({ room, rise, selected }: { room: Room; rise: number; selected: boolean }) {
  const pal = usePalette();
  const f = useMemo(() => stairFrame(room), [room]);
  const steps = useMemo(() => stairSteps(room, rise), [room, rise]);
  const yawAngle = -Math.atan2(f.u.y, f.u.x);
  const at = (a: number, c: number, h: number) => {
    const p = toPlan(f, a, c);
    return new Vector3(p.x, h, p.y);
  };

  const rails = useMemo(() => {
    const out: { from: Vector3; to: Vector3; r: number }[] = [];
    const divider = stairDivider(room);
    if (!divider) {
      const c = f.width - 0.06;
      out.push({ from: at(0, c, RAIL), to: at(f.length, c, rise + RAIL), r: 0.025 });
      out.push({ from: at(0, c, 0), to: at(0, c, RAIL), r: 0.02 });
      out.push({ from: at(f.length, c, rise), to: at(f.length, c, rise + RAIL), r: 0.02 });
      return out;
    }
    const half = f.width / 2;
    const run = Math.hypot(divider[1].x - divider[0].x, divider[1].y - divider[0].y);
    const lower = (a: number) => (a / run) * (rise / 2);
    const upper = (a: number) => rise / 2 + ((run - a) / run) * (rise / 2);
    out.push({ from: at(0, half - 0.05, RAIL), to: at(run, half - 0.05, rise / 2 + RAIL), r: 0.025 });
    out.push({ from: at(run, half + 0.05, rise / 2 + RAIL), to: at(0, half + 0.05, rise + RAIL), r: 0.025 });
    const n = Math.max(2, Math.round(run / BALUSTER_GAP) + 1);
    for (let i = 0; i < n; i++) {
      const a = (i / (n - 1)) * run;
      out.push({ from: at(a, half, lower(a)), to: at(a, half, upper(a) + RAIL), r: 0.015 });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, rise, f]);

  return (
    <group>
      {steps.map((s, i) => {
        const bottom = Math.max(0, s.top - SLAB);
        const c = at((s.a0 + s.a1) / 2, (s.c0 + s.c1) / 2, (s.top + bottom) / 2);
        return (
          <mesh key={i} position={c} rotation={[0, yawAngle, 0]} castShadow receiveShadow>
            <boxGeometry args={[s.a1 - s.a0, s.top - bottom, s.c1 - s.c0]} />
            <meshStandardMaterial color={selected ? pal.selected : pal.room} roughness={0.8} />
          </mesh>
        );
      })}
      {rails.map((r, i) => <Bar key={i} from={r.from} to={r.to} radius={r.r} color={pal.rail} />)}
    </group>
  );
}
