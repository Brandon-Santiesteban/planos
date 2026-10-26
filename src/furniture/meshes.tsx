// Parametric 3D furniture built from primitives. Local frame: x = width, y = up (0 at the base), z = depth,
// the front of a piece facing +z (plan +y at rotation 0). Every model scales with width/depth/height.
import { type ThreeEvent, useThree } from '@react-three/fiber';
import { type ReactElement, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { byElevation } from '../model/furnitureOps';
import type { Floor, Furniture } from '../model/types';
import { useEditor } from '../store/editorStore';
import { usePalette } from '../view3d/palette';
import { beginFurnitureDrag, dragFurnitureTo, type FurnitureDrag } from './actions';
import { type CatalogItem, catalogItem, type FurnitureModel } from './catalog';

type V3 = [number, number, number];

function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  return '#' + (k >= 1 ? c.lerp(new THREE.Color('#ffffff'), k - 1) : c.multiplyScalar(k)).getHexString();
}

/** Box given by its centre and size. */
function B({ p, s, c, r = 0.75, m = 0, o, e, rot }: { p: V3; s: V3; c: string; r?: number; m?: number; o?: number; e?: string; rot?: V3 }) {
  return (
    <mesh position={p} rotation={rot} castShadow receiveShadow>
      <boxGeometry args={[Math.max(s[0], 0.001), Math.max(s[1], 0.001), Math.max(s[2], 0.001)]} />
      <meshStandardMaterial color={c} roughness={r} metalness={m} transparent={o !== undefined} opacity={o ?? 1} emissive={e ?? '#000000'} emissiveIntensity={e ? 0.6 : 0} />
    </mesh>
  );
}

/** Vertical cylinder (or along `rot`) given by its centre. */
function C({ p, r: radius, h, c, top, rough = 0.6, m = 0, rot, e, seg = 20 }: { p: V3; r: number; h: number; c: string; top?: number; rough?: number; m?: number; rot?: V3; e?: string; seg?: number }) {
  return (
    <mesh position={p} rotation={rot} castShadow receiveShadow>
      <cylinderGeometry args={[top ?? radius, radius, h, seg]} />
      <meshStandardMaterial color={c} roughness={rough} metalness={m} emissive={e ?? '#000000'} emissiveIntensity={e ? 0.8 : 0} />
    </mesh>
  );
}

function S({ p, r, c, sc }: { p: V3; r: number; c: string; sc?: V3 }) {
  return (
    <mesh position={p} scale={sc} castShadow receiveShadow>
      <sphereGeometry args={[r, 16, 12]} />
      <meshStandardMaterial color={c} roughness={0.85} />
    </mesh>
  );
}

type P = { w: number; d: number; h: number; c: string; item?: CatalogItem };
type Builder = (p: P) => ReactElement;

const METAL = '#5a5f66';
const STEEL = '#c3c7cc';
const DARK = '#22252a';
const WHITE = '#f4f2ee';
const STONE = '#4a4846';
const GREEN = '#5f8a4a';

const legs = (w: number, d: number, h: number, t: number, c: string, inset = 0.03) =>
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
    <B key={`leg${i}`} p={[sx * (w / 2 - inset - t / 2), h / 2, sz * (d / 2 - inset - t / 2)]} s={[t, h, t]} c={c} />
  ));

const bed: Builder = ({ w, d, h, c, item }) => {
  const frame = shade('#b08a63', 0.85);
  const top = Math.min(0.55, h * 0.55);
  const pillows = item?.double ? 2 : 1;
  const pw = (w - 0.12 * (pillows + 1)) / pillows;
  return (
    <>
      <B p={[0, 0.17, 0]} s={[w, 0.24, d]} c={frame} />
      <B p={[0, (0.29 + top) / 2, 0.02]} s={[w - 0.04, top - 0.29, d - 0.08]} c={WHITE} r={0.9} />
      <B p={[0, top + 0.02, 0.18]} s={[w - 0.02, 0.06, d - 0.5]} c={c} r={0.95} />
      <B p={[0, h / 2, -d / 2 + 0.03]} s={[w, h, 0.06]} c={frame} />
      {Array.from({ length: pillows }, (_, i) => (
        <B key={i} p={[-w / 2 + 0.12 + pw / 2 + i * (pw + 0.12), top + 0.07, -d / 2 + 0.28]} s={[pw, 0.12, 0.34]} c={WHITE} r={0.95} />
      ))}
    </>
  );
};

const cabinet = (drawers: number, handle = METAL): Builder => ({ w, d, h, c }) => {
  const gap = (h - 0.08) / drawers;
  return (
    <>
      <B p={[0, h / 2 + 0.03, 0]} s={[w, h - 0.06, d]} c={c} />
      <B p={[0, 0.03, -0.02]} s={[w - 0.04, 0.06, d - 0.06]} c={shade(c, 0.6)} />
      {Array.from({ length: drawers }, (_, i) => (
        <group key={i}>
          <B p={[0, 0.06 + gap * (i + 0.5), d / 2 + 0.003]} s={[w - 0.04, gap - 0.02, 0.008]} c={shade(c, 1.06)} />
          <B p={[0, 0.06 + gap * (i + 0.5), d / 2 + 0.015]} s={[Math.min(0.2, w * 0.3), 0.015, 0.015]} c={handle} m={0.6} r={0.4} />
        </group>
      ))}
    </>
  );
};

const doorsBox: Builder = ({ w, d, h, c }) => {
  const n = Math.max(1, Math.round(w / 0.55));
  const dw = w / n;
  return (
    <>
      <B p={[0, h / 2, 0]} s={[w, h, d]} c={c} />
      {Array.from({ length: n }, (_, i) => (
        <group key={i}>
          <B p={[-w / 2 + dw * (i + 0.5), h / 2, d / 2 + 0.004]} s={[dw - 0.012, h - 0.03, 0.008]} c={shade(c, 1.04)} />
          <B p={[-w / 2 + dw * (i + 0.5) + (i % 2 ? -1 : 1) * (dw / 2 - 0.06), h / 2, d / 2 + 0.018]} s={[0.015, Math.min(0.3, h * 0.3), 0.015]} c={METAL} m={0.6} r={0.4} />
        </group>
      ))}
    </>
  );
};

const desk: Builder = ({ w, d, h, c }) => (
  <>
    <B p={[0, h - 0.015, 0]} s={[w, 0.03, d]} c={c} />
    {legs(w, d, h - 0.03, 0.04, DARK)}
  </>
);

const deskL: Builder = ({ w, d, h, c }) => {
  const top = Math.min(0.7, d);
  const side = Math.min(0.6, w);
  return (
    <>
      <B p={[0, h - 0.015, -d / 2 + top / 2]} s={[w, 0.03, top]} c={c} />
      <B p={[-w / 2 + side / 2, h - 0.015, (top) / 2]} s={[side, 0.03, d - top]} c={c} />
      <B p={[w / 2 - 0.03, (h - 0.03) / 2, -d / 2 + top / 2]} s={[0.04, h - 0.03, top - 0.06]} c={DARK} />
      <B p={[-w / 2 + side / 2, (h - 0.03) / 2, d / 2 - 0.03]} s={[side - 0.06, h - 0.03, 0.04]} c={DARK} />
      <B p={[-w / 2 + 0.03, (h - 0.03) / 2, -d / 2 + top / 2]} s={[0.04, h - 0.03, top - 0.06]} c={DARK} />
    </>
  );
};

const officeChair = (tall: boolean): Builder => ({ w, d, h, c }) => {
  const seatY = 0.47;
  const r = Math.min(w, d) / 2;
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return <B key={i} p={[(Math.cos(a) * r * 0.85) / 2, 0.06, (Math.sin(a) * r * 0.85) / 2]} s={[r * 0.9, 0.04, 0.05]} rot={[0, -a, 0]} c={DARK} />;
      })}
      <C p={[0, (0.08 + seatY) / 2, 0]} r={0.025} h={seatY - 0.08} c={METAL} m={0.7} />
      <B p={[0, seatY, 0.02]} s={[w * 0.8, 0.08, d * 0.75]} c={c} r={0.9} />
      <B p={[0, (seatY + h) / 2 + 0.03, -d * 0.36]} s={[w * (tall ? 0.72 : 0.75), h - seatY - 0.04, 0.07]} rot={[-0.12, 0, 0]} c={c} r={0.9} />
      {tall && <B p={[0, h - 0.12, -d * 0.36 - 0.03]} s={[w * 0.5, 0.12, 0.06]} c={'#a33a32'} />}
      {[-1, 1].map((sx) => <B key={sx} p={[sx * w * 0.42, seatY + 0.18, 0]} s={[0.05, 0.03, d * 0.45]} c={DARK} />)}
    </>
  );
};

const monitor: Builder = ({ w, d, h, c }) => {
  const screenH = Math.min(h * 0.82, w * 0.6);
  return (
    <>
      <B p={[0, 0.008, 0]} s={[Math.min(0.25, w * 0.4), 0.016, Math.min(0.18, d)]} c={DARK} />
      <B p={[0, (h - screenH / 2) / 2, -d * 0.2]} s={[0.04, h - screenH / 2, 0.03]} c={DARK} />
      <B p={[0, h - screenH / 2, -d * 0.1]} s={[w, screenH, 0.03]} c={c} r={0.35} />
      <B p={[0, h - screenH / 2, -d * 0.1 + 0.016]} s={[w - 0.02, screenH - 0.02, 0.002]} c={'#1f3346'} r={0.15} e={'#203a55'} />
    </>
  );
};

const tower: Builder = ({ w, d, h, c }) => (
  <>
    <B p={[0, h / 2, 0]} s={[w, h, d]} c={c} r={0.4} m={0.3} />
    <B p={[0, h * 0.75, d / 2 + 0.002]} s={[0.01, h * 0.35, 0.004]} c={'#7fc4ff'} e={'#4aa3ff'} />
  </>
);

const panel = (frame: string, face: { c?: string; r: number; m: number }): Builder => ({ w, d, h, c }) => (
  <>
    <B p={[0, h / 2, 0]} s={[w, h, d]} c={frame} m={0.5} r={0.4} />
    <B p={[0, h / 2, d / 2 + 0.002]} s={[w - 0.04, h - 0.04, 0.003]} c={face.c ?? c} r={face.r} m={face.m} />
  </>
);

const tv: Builder = ({ w, d, h, c }) => (
  <>
    <B p={[0, h / 2, 0]} s={[w, h, Math.min(d, 0.05)]} c={c} r={0.3} />
    <B p={[0, h / 2, Math.min(d, 0.05) / 2 + 0.002]} s={[w - 0.02, h - 0.02, 0.002]} c={'#141b24'} r={0.1} e={'#18283a'} />
  </>
);

const shelves: Builder = ({ w, d, h, c }) => {
  const n = Math.max(2, Math.round(h / 0.38));
  return (
    <>
      {[-1, 1].map((sx) => <B key={sx} p={[sx * (w / 2 - 0.01), h / 2, 0]} s={[0.02, h, d]} c={c} />)}
      <B p={[0, h / 2, -d / 2 + 0.005]} s={[w, h, 0.01]} c={shade(c, 0.85)} />
      {Array.from({ length: n + 1 }, (_, i) => <B key={i} p={[0, 0.01 + (i * (h - 0.02)) / n, 0]} s={[w - 0.04, 0.02, d]} c={c} />)}
      {Array.from({ length: n }, (_, i) => (
        <B key={`l${i}`} p={[-w * 0.2, 0.02 + (i * (h - 0.02)) / n + 0.12, 0]} s={[w * 0.35, 0.22, d * 0.7]} c={['#6d4c41', '#3f5e74', '#8a7a5c'][i % 3]} r={0.9} />
      ))}
    </>
  );
};

const lamp: Builder = ({ w, h, c }) => (
  <>
    <C p={[0, 0.015, 0]} r={w * 0.4} h={0.03} c={DARK} />
    <C p={[0, h / 2, 0]} r={0.012} h={h - 0.3} c={METAL} m={0.6} />
    <C p={[0, h - 0.15, 0]} r={w / 2} top={w * 0.36} h={0.3} c={c} e={'#ffcf8a'} />
  </>
);

const sofa: Builder = ({ w, d, h, c }) => {
  const arm = Math.min(0.18, w / 6);
  const back = Math.min(0.22, d / 3);
  const seatH = Math.min(0.45, h * 0.55);
  const seats = Math.max(1, Math.round((w - 2 * arm) / 0.65));
  const sw = (w - 2 * arm) / seats;
  return (
    <>
      <B p={[0, 0.03, 0]} s={[w - 0.08, 0.06, d - 0.08]} c={DARK} />
      <B p={[0, (0.06 + seatH - 0.1) / 2 + 0.03, back / 2]} s={[w - 2 * arm, seatH - 0.13, d - back]} c={shade(c, 0.9)} />
      {Array.from({ length: seats }, (_, i) => (
        <B key={i} p={[-w / 2 + arm + sw * (i + 0.5), seatH - 0.05, back / 2 + 0.01]} s={[sw - 0.02, 0.12, d - back - 0.02]} c={c} r={0.95} />
      ))}
      <B p={[0, (h + 0.06) / 2, -d / 2 + back / 2]} s={[w, h - 0.06, back]} c={c} r={0.95} />
      {[-1, 1].map((sx) => <B key={sx} p={[sx * (w / 2 - arm / 2), (seatH + 0.18 + 0.06) / 2, 0]} s={[arm, seatH + 0.18 - 0.06, d]} c={c} r={0.95} />)}
    </>
  );
};

const sofaL: Builder = ({ w, d, h, c }) => {
  const chaise = Math.min(0.9, w / 2);
  const main = Math.min(0.95, d);
  return (
    <>
      <group position={[0, 0, -d / 2 + main / 2]}>{sofa({ w, d: main, h, c })}</group>
      <B p={[w / 2 - chaise / 2, 0.21, main / 2]} s={[chaise - 0.02, 0.3, d - main]} c={shade(c, 0.9)} />
      <B p={[w / 2 - chaise / 2, 0.4, main / 2]} s={[chaise - 0.04, 0.1, d - main - 0.02]} c={c} r={0.95} />
      <B p={[w / 2 - 0.09, 0.32, main / 2]} s={[0.18, 0.5, d - main]} c={c} r={0.95} />
    </>
  );
};

const coffeeTable: Builder = ({ w, d, h, c }) => (
  <>
    <B p={[0, h - 0.025, 0]} s={[w, 0.05, d]} c={c} r={0.5} />
    <B p={[0, 0.12, 0]} s={[w - 0.1, 0.02, d - 0.1]} c={shade(c, 0.9)} />
    {legs(w, d, h - 0.05, 0.04, shade(c, 0.7))}
  </>
);

const chairAt = (x: number, z: number, ry: number, c: string, key?: string | number, w = 0.45, d = 0.48, h = 0.88) => (
  <group key={key} position={[x, 0, z]} rotation={[0, ry, 0]}>
    {chair({ w, d, h, c })}
  </group>
);

const chair: Builder = ({ w, d, h, c }) => {
  const seat = 0.46;
  return (
    <>
      <B p={[0, seat - 0.02, 0.02]} s={[w, 0.04, d - 0.04]} c={c} />
      {legs(w, d, seat - 0.04, 0.035, shade(c, 0.8), 0.02)}
      <B p={[0, (seat + h) / 2, -d / 2 + 0.03]} s={[w, h - seat, 0.04]} c={c} />
    </>
  );
};

const table: Builder = ({ w, d, h, c, item }) => {
  const seats = item?.withChairs ? item.seats ?? 0 : 0;
  const per = Math.max(1, Math.floor(seats / 2));
  return (
    <>
      <B p={[0, h - 0.02, 0]} s={[w, 0.04, d]} c={c} r={0.55} />
      {legs(w, d, h - 0.04, 0.06, shade(c, 0.8), 0.06)}
      {seats > 0 && Array.from({ length: per }, (_, i) => {
        const x = -w / 2 + (w * (i + 0.5)) / per;
        return [chairAt(x, -d / 2 - 0.18, Math.PI, shade(c, 0.85), `n${i}`), chairAt(x, d / 2 + 0.18, 0, shade(c, 0.85), `s${i}`)];
      })}
    </>
  );
};

const counter = (extra?: (p: P) => ReactElement): Builder => (p) => {
  const { w, d, h, c } = p;
  return (
    <>
      <B p={[0, 0.05, -0.03]} s={[w, 0.1, d - 0.06]} c={DARK} />
      <B p={[0, (h - 0.04 + 0.1) / 2, 0]} s={[w, h - 0.14, d - 0.02]} c={c} />
      <B p={[0, (h - 0.04 + 0.1) / 2, d / 2 - 0.005]} s={[0.004, h - 0.18, 0.012]} c={shade(c, 0.85)} />
      <B p={[0, h - 0.02, 0]} s={[w, 0.04, d]} c={STONE} r={0.35} />
      {extra?.(p)}
    </>
  );
};

const kitchenSink = counter(({ w, d, h }) => (
  <>
    <B p={[0, h - 0.005, 0.03]} s={[Math.min(0.5, w - 0.12), 0.012, d - 0.22]} c={STEEL} m={0.8} r={0.25} />
    <C p={[0, h + 0.15, -d / 2 + 0.08]} r={0.015} h={0.3} c={STEEL} m={0.9} rough={0.2} />
    <B p={[0, h + 0.29, -d / 2 + 0.15]} s={[0.025, 0.025, 0.16]} c={STEEL} m={0.9} r={0.2} />
  </>
));

const stove: Builder = ({ w, d, h, c }) => (
  <>
    <B p={[0, (h - 0.03) / 2, 0]} s={[w, h - 0.03, d]} c={c} m={0.6} r={0.35} />
    <B p={[0, h - 0.015, 0]} s={[w, 0.03, d]} c={DARK} r={0.2} />
    {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => <C key={i} p={[(sx * w) / 4.4, h + 0.01, (sz * d) / 4.4]} r={Math.min(w, d) * 0.12} h={0.02} c={'#111'} />)}
    <B p={[0, h * 0.45, d / 2 + 0.003]} s={[w - 0.08, h * 0.45, 0.006]} c={'#1b1d20'} r={0.1} />
    <B p={[0, h * 0.72, d / 2 + 0.02]} s={[w - 0.14, 0.02, 0.02]} c={STEEL} m={0.9} r={0.2} />
  </>
);

const fridge: Builder = ({ w, d, h, c }) => (
  <>
    <B p={[0, h / 2, 0]} s={[w, h, d]} c={c} m={0.55} r={0.3} />
    <B p={[0, h * 0.62, d / 2 + 0.002]} s={[w - 0.01, 0.01, 0.005]} c={shade(c, 0.6)} />
    {[h * 0.8, h * 0.45].map((y) => <B key={y} p={[w / 2 - 0.07, y, d / 2 + 0.025]} s={[0.02, 0.28, 0.02]} c={DARK} />)}
  </>
);

const toilet: Builder = ({ w, d, h, c }) => (
  <>
    <B p={[0, h * 0.72, -d / 2 + d * 0.13]} s={[w, h * 0.55, d * 0.24]} c={c} r={0.25} />
    <C p={[0, 0.2, d * 0.08]} r={w * 0.32} top={w * 0.42} h={0.4} c={c} rough={0.25} />
    <mesh position={[0, 0.41, d * 0.1]} scale={[1, 1, 1.35]} castShadow>
      <cylinderGeometry args={[w * 0.46, w * 0.46, 0.03, 24]} />
      <meshStandardMaterial color={c} roughness={0.25} />
    </mesh>
  </>
);

const basin: Builder = ({ w, d, h, c, item }) => {
  const n = item?.double ? 2 : 1;
  return (
    <>
      <B p={[0, (h - 0.12) / 2 + 0.1, -0.02]} s={[w - 0.04, h - 0.22, d - 0.06]} c={'#b08a63'} />
      <B p={[0, h - 0.05, 0]} s={[w, 0.1, d]} c={c} r={0.25} />
      {Array.from({ length: n }, (_, i) => {
        const x = -w / 2 + (w * (i + 0.5)) / n;
        return (
          <group key={i}>
            <mesh position={[x, h + 0.001, 0.03]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.75, 1]}>
              <circleGeometry args={[Math.min(0.2, w / n / 2 - 0.08), 24]} />
              <meshStandardMaterial color={'#dfe4e6'} roughness={0.2} />
            </mesh>
            <C p={[x, h + 0.08, -d / 2 + 0.07]} r={0.012} h={0.16} c={STEEL} m={0.9} rough={0.2} />
          </group>
        );
      })}
    </>
  );
};

const shower: Builder = ({ w, d, h, c }) => (
  <>
    <B p={[0, 0.025, 0]} s={[w, 0.05, d]} c={WHITE} r={0.3} />
    <B p={[0, h / 2, d / 2 - 0.005]} s={[w, h, 0.01]} c={c} o={0.25} r={0.05} />
    <B p={[w / 2 - 0.005, h / 2, 0]} s={[0.01, h, d]} c={c} o={0.25} r={0.05} />
    <C p={[0, h - 0.15, -d / 2 + 0.25]} r={0.1} h={0.02} c={STEEL} m={0.9} rough={0.2} />
    <B p={[0, h - 0.13, -d / 2 + 0.13]} s={[0.02, 0.02, 0.26]} c={STEEL} m={0.9} r={0.2} />
  </>
);

const tub: Builder = ({ w, d, h, c }) => (
  <>
    <B p={[0, h / 2, 0]} s={[w, h, d]} c={c} r={0.25} />
    <B p={[0, h - 0.02, 0]} s={[w - 0.14, 0.04, d - 0.14]} c={'#cfe3ea'} r={0.1} />
  </>
);

const washtub: Builder = ({ w, d, h, c }) => (
  <>
    <B p={[0, (h - 0.2) / 2, 0]} s={[w, h - 0.2, d]} c={shade(c, 0.9)} r={0.95} />
    <B p={[0, h - 0.1, 0]} s={[w, 0.2, d]} c={c} r={0.95} />
    <B p={[-w / 4 + 0.02, h - 0.01, 0]} s={[w / 2 - 0.08, 0.02, d - 0.1]} c={'#9fb6c0'} r={0.2} />
    {Array.from({ length: 5 }, (_, i) => <B key={i} p={[w * 0.05 + i * w * 0.08, h + 0.005, 0]} s={[0.015, 0.01, d - 0.12]} c={shade(c, 0.8)} />)}
  </>
);

const washer: Builder = ({ w, d, h, c }) => (
  <>
    <B p={[0, h / 2, 0]} s={[w, h, d]} c={c} r={0.3} />
    <C p={[0, h * 0.45, d / 2 + 0.01]} r={Math.min(w, h) * 0.28} h={0.02} c={'#3d4b55'} rough={0.1} rot={[Math.PI / 2, 0, 0]} />
    <B p={[0, h - 0.08, d / 2 + 0.003]} s={[w - 0.06, 0.1, 0.006]} c={shade(c, 0.9)} />
  </>
);

const plant: Builder = ({ w, d, h, c }) => {
  const r = Math.min(w, d) / 2;
  const pot = Math.min(0.45, h * 0.4);
  const foliage = h - pot;
  return (
    <>
      <C p={[0, pot / 2, 0]} r={r * 0.75} top={r} h={pot} c={c} rough={0.9} />
      <C p={[0, pot + foliage * 0.25, 0]} r={0.02} h={foliage * 0.5} c={'#6b4e2e'} />
      <S p={[0, pot + foliage * 0.55, 0]} r={r * 1.05} c={GREEN} sc={[1, foliage / (2 * r) * 0.8, 1]} />
      <S p={[r * 0.35, pot + foliage * 0.8, r * 0.2]} r={r * 0.6} c={shade(GREEN, 1.15)} />
    </>
  );
};

const bench: Builder = ({ w, d, h, c }) => (
  <>
    {Array.from({ length: 4 }, (_, i) => <B key={i} p={[0, h - 0.02, -d / 2 + (d * (i + 0.5)) / 4]} s={[w, 0.035, d / 4 - 0.02]} c={c} />)}
    {[-1, 1].map((sx) => <B key={sx} p={[sx * (w / 2 - 0.1), (h - 0.04) / 2, 0]} s={[0.06, h - 0.04, d - 0.05]} c={DARK} />)}
  </>
);

const car: Builder = ({ w, d, h, c }) => {
  const wheelR = Math.min(0.33, h * 0.23);
  const body = h * 0.45;
  return (
    <>
      <B p={[0, wheelR + body / 2 - 0.05, 0]} s={[w, body, d]} c={c} r={0.3} m={0.5} />
      <B p={[-w * 0.04, wheelR + body - 0.05 + (h - wheelR - body + 0.05) / 2, 0]} s={[w * 0.5, h - wheelR - body + 0.05, d * 0.86]} c={'#2d3a44'} r={0.1} m={0.3} />
      <B p={[-w * 0.04, h - 0.02, 0]} s={[w * 0.4, 0.04, d * 0.84]} c={c} r={0.3} m={0.5} />
      {[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz], i) => (
        <C key={i} p={[sx * w * 0.32, wheelR, sz * (d / 2 - 0.12)]} r={wheelR} h={0.22} c={'#1a1a1a'} rough={0.9} rot={[Math.PI / 2, 0, 0]} />
      ))}
      {[-1, 1].map((sz) => <B key={sz} p={[w / 2 + 0.005, wheelR + body * 0.6, sz * (d / 2 - 0.25)]} s={[0.01, 0.08, 0.3]} c={'#fff6d8'} e={'#fff1c4'} />)}
      {[-1, 1].map((sz) => <B key={`t${sz}`} p={[-w / 2 - 0.005, wheelR + body * 0.6, sz * (d / 2 - 0.25)]} s={[0.01, 0.08, 0.3]} c={'#a01818'} />)}
    </>
  );
};

const moto: Builder = ({ w, d, h, c }) => {
  const r = Math.min(0.32, h * 0.3);
  return (
    <>
      {[-1, 1].map((sx) => <C key={sx} p={[sx * (w / 2 - r), r, 0]} r={r} h={0.12} c={'#1a1a1a'} rough={0.9} rot={[Math.PI / 2, 0, 0]} />)}
      <B p={[0, r + 0.2, 0]} s={[w * 0.5, 0.3, 0.28]} c={c} r={0.3} m={0.5} />
      <B p={[-w * 0.12, r + 0.4, 0]} s={[w * 0.35, 0.1, 0.28]} c={DARK} r={0.9} />
      <B p={[w * 0.3, h - 0.15, 0]} s={[0.06, 0.3, 0.06]} c={METAL} m={0.7} />
      <B p={[w * 0.32, h - 0.02, 0]} s={[0.04, 0.04, Math.min(d, 0.7)]} c={DARK} />
    </>
  );
};

const pool: Builder = ({ w, d, h, c }) => {
  const t = 0.15;
  const water = h - 0.15;
  return (
    <>
      {/* Walls and coping in the wall colour */}
      <B p={[0, h / 2, -d / 2 + t / 2]} s={[w, h, t]} c={c} r={0.85} />
      <B p={[0, h / 2, d / 2 - t / 2]} s={[w, h, t]} c={c} r={0.85} />
      <B p={[-w / 2 + t / 2, h / 2, 0]} s={[t, h, d - 2 * t]} c={c} r={0.85} />
      <B p={[w / 2 - t / 2, h / 2, 0]} s={[t, h, d - 2 * t]} c={c} r={0.85} />
      <B p={[0, h + 0.02, -d / 2 + t / 2]} s={[w + 0.06, 0.04, t + 0.06]} c={shade(c, 1.05)} r={0.6} />
      <B p={[0, h + 0.02, d / 2 - t / 2]} s={[w + 0.06, 0.04, t + 0.06]} c={shade(c, 1.05)} r={0.6} />
      <B p={[-w / 2 + t / 2, h + 0.02, 0]} s={[t + 0.06, 0.04, d - 2 * t]} c={shade(c, 1.05)} r={0.6} />
      <B p={[w / 2 - t / 2, h + 0.02, 0]} s={[t + 0.06, 0.04, d - 2 * t]} c={shade(c, 1.05)} r={0.6} />
      {/* Tiled inside, a lighter rim at the waterline and translucent water */}
      <B p={[0, 0.05, 0]} s={[w - 2 * t, 0.1, d - 2 * t]} c={'#7cc4dc'} r={0.4} />
      <B p={[0, water - 0.02, -d / 2 + t + 0.01]} s={[w - 2 * t, 0.06, 0.02]} c={'#bfe8f3'} r={0.3} />
      <B p={[0, water - 0.02, d / 2 - t - 0.01]} s={[w - 2 * t, 0.06, 0.02]} c={'#bfe8f3'} r={0.3} />
      <B p={[-w / 2 + t + 0.01, water - 0.02, 0]} s={[0.02, 0.06, d - 2 * t]} c={'#bfe8f3'} r={0.3} />
      <B p={[w / 2 - t - 0.01, water - 0.02, 0]} s={[0.02, 0.06, d - 2 * t]} c={'#bfe8f3'} r={0.3} />
      <mesh position={[0, (water + 0.1) / 2, 0]} receiveShadow>
        <boxGeometry args={[w - 2 * t - 0.002, water - 0.1, d - 2 * t - 0.002]} />
        <meshStandardMaterial color={'#3fa7d6'} transparent opacity={0.55} roughness={0.08} metalness={0.1} depthWrite={false} />
      </mesh>
    </>
  );
};

const lounger: Builder = ({ w, d, c }) => {
  const seatY = 0.32;
  const backLen = d * 0.36;
  return (
    <>
      <B p={[0, seatY - 0.05, 0]} s={[w, 0.05, d]} c={shade('#9a7650', 1)} />
      {legs(w, d, seatY - 0.08, 0.04, '#7a5a3f', 0.04)}
      <B p={[0, seatY + 0.02, d * 0.17]} s={[w - 0.06, 0.08, d * 0.62]} c={c} r={0.95} />
      <B
        p={[0, seatY + Math.sin(0.9) * backLen / 2, -d / 2 + Math.cos(0.9) * backLen / 2]}
        s={[w - 0.06, 0.08, backLen]}
        rot={[0.9, 0, 0]}
        c={c}
        r={0.95}
      />
    </>
  );
};

const umbrella: Builder = ({ w, d, h, c }) => {
  const r = Math.min(w, d) / 2;
  return (
    <>
      <C p={[0, 0.04, 0]} r={0.25} h={0.08} c={DARK} />
      <C p={[0, h / 2, 0]} r={0.025} h={h} c={WHITE} />
      <mesh position={[0, h - 0.25, 0]} castShadow receiveShadow>
        <coneGeometry args={[r, 0.5, 8, 1, true]} />
        <meshStandardMaterial color={c} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
};

const pergola: Builder = ({ w, d, h, c }) => {
  const post = 0.12;
  const n = Math.max(3, Math.round(w / 0.3));
  return (
    <>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <B key={i} p={[sx * (w / 2 - post / 2), (h - 0.2) / 2, sz * (d / 2 - post / 2)]} s={[post, h - 0.2, post]} c={c} />
      ))}
      {[-1, 1].map((sz) => <B key={sz} p={[0, h - 0.13, sz * (d / 2 - post / 2)]} s={[w + 0.2, 0.14, 0.08]} c={c} />)}
      {[-1, 1].map((sx) => <B key={`b${sx}`} p={[sx * (w / 2 - post / 2), h - 0.13, 0]} s={[0.08, 0.14, d]} c={c} />)}
      {Array.from({ length: n }, (_, i) => (
        <B key={`s${i}`} p={[-w / 2 + (w * (i + 0.5)) / n, h - 0.03, 0]} s={[0.05, 0.06, d + 0.2]} c={shade(c, 1.1)} />
      ))}
    </>
  );
};

const bar: Builder = ({ w, d, h, c, item }) => {
  const n = item?.seats ?? 3;
  return (
    <>
      <B p={[0, (h - 0.04) / 2, -0.05]} s={[w, h - 0.04, d - 0.15]} c={c} />
      <B p={[0, h - 0.02, 0.02]} s={[w + 0.05, 0.04, d + 0.05]} c={STONE} r={0.35} />
      {Array.from({ length: n }, (_, i) => {
        const x = -w / 2 + (w * (i + 0.5)) / n;
        return (
          <group key={i} position={[x, 0, d / 2 + 0.22]}>
            <C p={[0, 0.015, 0]} r={0.18} h={0.03} c={DARK} />
            <C p={[0, 0.36, 0]} r={0.025} h={0.66} c={METAL} m={0.7} />
            <C p={[0, 0.7, 0]} r={0.17} h={0.05} c={shade(c, 0.8)} />
          </group>
        );
      })}
    </>
  );
};

const grill: Builder = ({ w, d, h, c }) => {
  const top = h * 0.82;
  const gw = w * 0.6;
  return (
    <>
      {legs(w, d, top - 0.1, 0.04, DARK, 0.03)}
      <B p={[0, top - 0.25, 0]} s={[w, 0.03, d]} c={METAL} />
      <B p={[-w / 2 + gw / 2, top - 0.05, 0]} s={[gw, 0.12, d]} c={c} m={0.4} r={0.4} />
      <mesh position={[-w / 2 + gw / 2, top + 0.01, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[d / 2, d / 2, gw, 20, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={c} metalness={0.4} roughness={0.4} side={THREE.DoubleSide} />
      </mesh>
      <B p={[w / 2 - (w - gw) / 2, top - 0.02, 0]} s={[w - gw, 0.04, d]} c={'#9a7650'} />
    </>
  );
};

const planter: Builder = ({ w, d, h, c }) => {
  const box = Math.min(h, 0.6) * 0.75;
  const n = Math.max(2, Math.round(w / 0.3));
  return (
    <>
      <B p={[0, box / 2, 0]} s={[w, box, d]} c={c} r={0.9} />
      <B p={[0, box - 0.01, 0]} s={[w - 0.06, 0.02, d - 0.06]} c={'#5b4632'} r={1} />
      {Array.from({ length: n }, (_, i) => (
        <S key={i} p={[-w / 2 + (w * (i + 0.5)) / n, box + (h - box) * 0.45, 0]} r={Math.min(d * 0.55, w / n * 0.7)} c={i % 2 ? GREEN : shade(GREEN, 1.15)} sc={[1, Math.max(0.6, (h - box) / Math.min(d, w / n)), 1]} />
      ))}
    </>
  );
};

const rug: Builder = ({ w, d, h, c }) => <B p={[0, Math.max(h, 0.008) / 2, 0]} s={[w, Math.max(h, 0.008), d]} c={c} r={1} />;

const BUILDERS: Record<FurnitureModel, Builder> = {
  cama: bed, mesaNoche: cabinet(2), closet: doorsBox, comoda: cabinet(3), escritorio: desk, escritorioL: deskL,
  sillaOficina: officeChair(false), sillaGamer: officeChair(true), monitor, torre: tower,
  tablero: panel('#c9ccd0', { c: '#fbfbf9', r: 0.2, m: 0 }), estanteria: shelves, lampara: lamp, sofa, sofaL,
  sillon: sofa, mesaCentro: coffeeTable, muebleTV: cabinet(1), televisor: tv, alfombra: rug, mesa: table, silla: chair,
  meson: counter(), estufa: stove, nevera: fridge, lavaplatos: kitchenSink, alacena: doorsBox, sanitario: toilet,
  lavamanos: basin, ducha: shower, banera: tub, espejo: panel('#8c9096', { c: '#dfe9ef', r: 0.02, m: 1 }),
  lavadero: washtub, lavadora: washer, matera: plant, banca: bench, carro: car, moto, piscina: pool,
  asoleadora: lounger, sombrilla: umbrella, pergola, bar, parrilla: grill, jardinera: planter,
};

/** The model of one piece in its local frame (no position or rotation). */
export function FurnitureModel3D({ f }: { f: Furniture }) {
  const item = catalogItem(f.type);
  const c = f.color ?? item?.color ?? '#b08a63';
  const build = item ? BUILDERS[item.model] : null;
  return build ? build({ w: f.width, d: f.depth, h: f.height, c, item }) : <B p={[0, f.height / 2, 0]} s={[f.width, f.height, f.depth]} c={c} />;
}

function SelectionBox({ f, color }: { f: Furniture; color: string }) {
  const geometry = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(f.width + 0.04, f.height + 0.04, f.depth + 0.04)), [f.width, f.height, f.depth]);
  return (
    <lineSegments geometry={geometry} position={[0, f.height / 2, 0]}>
      <lineBasicMaterial color={color} />
    </lineSegments>
  );
}

type Controls = { enabled: boolean } | null;

/** Every piece of a floor, at the floor's elevation. A click selects; dragging a selected piece moves it on its floor (one undo step). */
export default function FurnitureMeshes({ floor, elevation, selectedId }: { floor: Floor; elevation: number; selectedId: string | null }) {
  const pal = usePalette();
  const { camera, gl } = useThree();
  const controls = useThree((s) => s.controls) as unknown as Controls;
  const dragRef = useRef<{ drag: FurnitureDrag; plane: THREE.Plane; offset: { x: number; y: number }; started: boolean; downX: number; downY: number } | null>(null);

  const onClick = (e: ThreeEvent<MouseEvent>, f: Furniture) => {
    if (e.delta > 4) return; // that was a camera drag, not a click
    e.stopPropagation();
    const store = useEditor.getState();
    if (store.activeFloorId !== floor.id) store.setActiveFloor(floor.id);
    useEditor.getState().select({ kind: 'furniture', id: f.id });
  };

  // Only an already selected piece is dragged: dragging anything else orbits the camera.
  const onPointerDown = (e: ThreeEvent<PointerEvent>, f: Furniture) => {
    if (e.button !== 0 || f.id !== selectedId) return;
    e.stopPropagation();
    const drag = beginFurnitureDrag(f.id, floor.id);
    if (!drag) return;
    if (controls) controls.enabled = false;
    dragRef.current = {
      drag,
      plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -e.point.y),
      offset: { x: f.x - e.point.x, y: f.y - e.point.z },
      started: false,
      downX: e.nativeEvent.clientX,
      downY: e.nativeEvent.clientY,
    };
    const raycaster = new THREE.Raycaster();
    const hit = new THREE.Vector3();
    const move = (ev: PointerEvent) => {
      const st = dragRef.current;
      if (!st) return;
      if (!st.started) {
        if (Math.hypot(ev.clientX - st.downX, ev.clientY - st.downY) < 3) return;
        useEditor.getState().checkpoint();
        st.started = true;
      }
      const r = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(st.plane, hit)) return;
      const snap = useEditor.getState().snapping && !ev.altKey;
      dragFurnitureTo(st.drag, { x: hit.x + st.offset.x, y: hit.z + st.offset.y }, snap, true);
    };
    const up = () => {
      dragRef.current = null;
      if (controls) controls.enabled = true;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <group position={[0, elevation, 0]}>
      {byElevation(floor.furniture ?? []).map((f) => (
        <group
          key={f.id}
          position={[f.x, f.elevation, f.y]}
          rotation={[0, (-f.rotation * Math.PI) / 180, 0]}
          onPointerDown={(e) => onPointerDown(e, f)}
          onClick={(e) => onClick(e, f)}
        >
          <FurnitureModel3D f={f} />
          {f.id === selectedId && <SelectionBox f={f} color={pal.selected} />}
        </group>
      ))}
    </group>
  );
}
