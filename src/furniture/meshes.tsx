// Parametric 3D furniture built from primitives. Local frame: x = width, y = up (0 at the base), z = depth,
// the front of a piece facing +z (plan +y at rotation 0). Every model scales with width/depth/height.
import { type ThreeEvent, useThree } from '@react-three/fiber';
import { type ReactElement, type ReactNode, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { byElevation, tiltedSize } from '../model/furnitureOps';
import type { Floor, Furniture } from '../model/types';
import { useEditor } from '../store/editorStore';
import { usePalette } from '../view3d/palette';
import { beginFurnitureDrag, dragFurnitureTo, type FurnitureDrag } from './actions';
import { type CatalogItem, catalogItem, type FurnitureModel } from './catalog';
import { gatePanels } from './gate';

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

/** Rounded boxes are shared per size and radius (pieces repeat a lot: chairs, cushions, doors). */
const roundedCache = new Map<string, THREE.BufferGeometry>();
function roundedBox(s: V3, radius: number): THREE.BufferGeometry {
  const size = s.map((v) => Math.max(v, 0.002)) as V3;
  const rad = Math.min(radius, size[0] / 2, size[1] / 2, size[2] / 2) * 0.98;
  const key = `${size.map((v) => v.toFixed(3)).join(',')}:${rad.toFixed(3)}`;
  let g = roundedCache.get(key);
  if (!g) {
    g = new RoundedBoxGeometry(size[0], size[1], size[2], 3, rad);
    roundedCache.set(key, g);
  }
  return g;
}

/** Box with rounded edges (radius `rad`), given by its centre and size: cushions, mattresses, tops, bodies. */
function RB({ p, s, c, rad = 0.03, r = 0.8, m = 0, rot }: { p: V3; s: V3; c: string; rad?: number; r?: number; m?: number; rot?: V3 }) {
  return (
    <mesh position={p} rotation={rot} geometry={roundedBox(s, rad)} castShadow receiveShadow>
      <meshStandardMaterial color={c} roughness={r} metalness={m} />
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

/** `seed` is stable per piece (from its id): trees use it to vary their shape and greens. */
type P = { w: number; d: number; h: number; c: string; item?: CatalogItem; seed?: number; open?: boolean };
type Builder = (p: P) => ReactElement;

const METAL = '#5a5f66';
const STEEL = '#c3c7cc';
const DARK = '#22252a';
const WHITE = '#f4f2ee';
const STONE = '#4a4846';
const GREEN = '#5f8a4a';

const WOOD = '#8a6446';
const WOOD_DARK = '#4e3a2b';

/** Four round legs, slimmer at the floor, their centres `inset` in from the corners of a w × d footprint. */
const taperedLegs = (w: number, d: number, h: number, c: string, inset = 0.05, r = 0.022) =>
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
    <C key={`tl${i}`} p={[sx * (w / 2 - inset), h / 2, sz * (d / 2 - inset)]} r={r * 0.65} top={r} h={h} c={c} rough={0.6} seg={12} />
  ));

const legs = (w: number, d: number, h: number, t: number, c: string, inset = 0.03) =>
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
    <B key={`leg${i}`} p={[sx * (w / 2 - inset - t / 2), h / 2, sz * (d / 2 - inset - t / 2)]} s={[t, h, t]} c={c} />
  ));

const bed: Builder = ({ w, d, h, c, item }) => {
  const frame = shade('#b08a63', 0.85);
  const leg = 0.12;
  const base = leg + 0.2;
  const top = base + 0.25;
  const pillows = item?.double ? 2 : 1;
  const pw = (w - 0.1 * (pillows + 1)) / pillows;
  const duvet = d * 0.66;
  const channels = Math.max(3, Math.round(w / 0.28));
  const cw = (w - 0.06) / channels;
  return (
    <>
      {taperedLegs(w - 0.04, d - 0.04, leg, WOOD_DARK, 0.06, 0.025)}
      <RB p={[0, leg + 0.1, 0]} s={[w, 0.2, d]} c={frame} rad={0.02} r={0.7} />
      <RB p={[0, base + 0.125, 0.02]} s={[w - 0.06, 0.25, d - 0.1]} c={WHITE} rad={0.06} r={0.95} />
      {/* Duvet over the lower two thirds, falling over the sides, a folded band at its head and a throw at the foot. */}
      <RB p={[0, top + 0.015, d / 2 - duvet / 2 - 0.02]} s={[w - 0.02, 0.05, duvet]} c={c} rad={0.025} r={1} />
      {[-1, 1].map((sx) => <RB key={sx} p={[sx * (w / 2 - 0.02), top - 0.09, d / 2 - duvet / 2 - 0.02]} s={[0.04, 0.22, duvet]} c={c} rad={0.015} r={1} />)}
      <RB p={[0, top + 0.035, d / 2 - duvet - 0.02]} s={[w - 0.01, 0.06, 0.16]} c={shade(c, 1.12)} rad={0.03} r={1} />
      <RB p={[0, top + 0.05, d / 2 - 0.32]} s={[w + 0.02, 0.025, 0.42]} c={shade(c, 0.62)} rad={0.012} r={1} />
      {Array.from({ length: pillows }, (_, i) => (
        <RB key={i} p={[-w / 2 + 0.1 + pw / 2 + i * (pw + 0.1), top + 0.1, -d / 2 + 0.24]} s={[pw, 0.16, 0.34]} rot={[-0.45, 0, 0]} c={WHITE} rad={0.07} r={1} />
      ))}
      {item?.double && <RB p={[0, top + 0.1, -d / 2 + 0.44]} s={[Math.min(0.5, w * 0.3), 0.16, 0.12]} rot={[-0.3, 0, 0]} c={shade(c, 0.62)} rad={0.05} r={1} />}
      {/* Upholstered headboard with vertical channels. */}
      <RB p={[0, (leg + h) / 2, -d / 2 + 0.03]} s={[w + 0.06, h - leg, 0.06]} c={frame} rad={0.02} r={0.7} />
      {Array.from({ length: channels }, (_, i) => (
        <RB key={`ch${i}`} p={[-w / 2 + 0.03 + cw * (i + 0.5), (base + 0.1 + h - 0.04) / 2, -d / 2 + 0.08]} s={[cw - 0.01, h - 0.04 - base - 0.1, 0.06]} c={shade(c, 0.86)} rad={0.025} r={1} />
      ))}
    </>
  );
};

const cabinet = (drawers: number, handle = METAL): Builder => ({ w, d, h, c }) => {
  const leg = Math.min(0.12, h * 0.25);
  const body = h - leg;
  const gap = (body - 0.04) / drawers;
  return (
    <>
      {taperedLegs(w, d, leg, WOOD_DARK, 0.05, 0.018)}
      <RB p={[0, leg + body / 2, 0]} s={[w, body, d]} c={c} rad={0.012} r={0.7} />
      {Array.from({ length: drawers }, (_, i) => {
        const y = leg + 0.02 + gap * (i + 0.5);
        return (
          <group key={i}>
            <RB p={[0, y, d / 2 + 0.002]} s={[w - 0.04, gap - 0.012, 0.012]} c={shade(c, 1.05)} rad={0.004} r={0.65} />
            <B p={[0, y + gap * 0.18, d / 2 + 0.014]} s={[Math.min(0.24, w * 0.35), 0.012, 0.012]} c={handle} m={0.7} r={0.35} />
          </group>
        );
      })}
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

/** Open walk-in dressing module (wood carcass, LED strip under the top) holding clothes, shelves, shoes or drawers. */
const CLOTHES = ['#E8DBD3', '#2b2d31', '#C6B1A0', '#495762', '#f2efe9', '#8C8A7D', '#1f2124', '#B77E53'];
const dressing: Builder = ({ w, d, h, c, item }) => {
  const kind = item?.dressing ?? 'repisas';
  const t = 0.025;
  const iw = w - 2 * t;
  const front = d / 2;
  const shelf = (y: number, key: string) => <B key={key} p={[0, y, 0]} s={[iw, 0.022, d - 0.02]} c={c} />;
  const led = (y: number, key: string) => <B key={key} p={[0, y, front - 0.04]} s={[iw, 0.01, 0.02]} c="#fff3dd" e="#ffd9a0" />;
  const drawers = (n: number, top: number) => {
    const hh = (top - 0.08) / n;
    return (
      <>
        <B p={[0, (top + 0.08) / 2, -0.01]} s={[iw, top - 0.08, d - 0.04]} c={c} />
        {Array.from({ length: n }, (_, i) => {
          const y = 0.08 + hh * (i + 0.5);
          return (
            <group key={i}>
              <B p={[0, y, front - 0.012]} s={[iw - 0.012, hh - 0.012, 0.02]} c={shade(c, 1.08)} />
              <B p={[0, y + hh * 0.2, front + 0.004]} s={[iw * 0.45, 0.012, 0.012]} c={DARK} m={0.5} />
            </group>
          );
        })}
        <B p={[0, top + 0.012, 0]} s={[iw, 0.025, d]} c={shade(c, 1.1)} />
      </>
    );
  };
  const folded = (y: number, n: number, key: string) => (
    <group key={key}>
      {Array.from({ length: n }, (_, i) => {
        const x = -iw / 2 + (iw / n) * (i + 0.5);
        const sh = 0.1 + ((i * 7 + Math.round(y * 10)) % 3) * 0.03;
        return <B key={i} p={[x, y + sh / 2, 0.02]} s={[Math.max(0.1, Math.min(0.3, iw / n - 0.05)), sh, d * 0.6]} c={CLOTHES[(i * 3 + Math.round(y * 10)) % CLOTHES.length]} r={0.95} />;
      })}
    </group>
  );
  let inside: ReactElement;
  if (kind === 'colgar') {
    const rod = h - 0.42;
    const n = Math.max(3, Math.floor(iw / 0.075));
    inside = (
      <>
        {drawers(2, 0.62)}
        {shelf(h - 0.32, 'top')}
        {led(h - 0.34, 'led2')}
        <C p={[0, rod, 0]} r={0.012} h={iw} c={METAL} m={0.7} rot={[0, 0, Math.PI / 2]} />
        {Array.from({ length: n }, (_, i) => {
          const x = -iw / 2 + 0.05 + (i * (iw - 0.1)) / (n - 1);
          const len = Math.min(rod - 0.75, 0.75 + ((i * 37) % 5) * 0.07);
          return <B key={i} p={[x, rod - 0.04 - len / 2, 0.01]} s={[0.035, len, d * 0.72]} c={CLOTHES[(i * 3) % CLOTHES.length]} r={0.95} />;
        })}
        {folded(h - 0.31, 2, 'boxes')}
      </>
    );
  } else if (kind === 'zapatos') {
    const levels = [0.14, 0.38, 0.62, 0.86];
    const pairs = Math.max(1, Math.floor(iw / 0.22));
    const shoe = ['#3b2a20', '#f1efea', '#1f2124', '#7a5233'];
    inside = (
      <>
        {levels.map((y, l) => (
          <group key={l} position={[0, y, 0]} rotation={[0.28, 0, 0]}>
            <B p={[0, 0, 0]} s={[iw, 0.02, d - 0.06]} c={c} />
            {Array.from({ length: pairs }, (_, i) => [-0.05, 0.05].map((dx) => (
              <B key={`${i}${dx}`} p={[-iw / 2 + (iw / pairs) * (i + 0.5) + dx, 0.045, 0.02]} s={[0.08, 0.07, Math.min(0.27, d - 0.1)]} c={shoe[(l + i) % shoe.length]} r={0.6} />
            )))}
          </group>
        ))}
        {[1.15, 1.6, 2.0].map((y, i) => shelf(y, `s${i}`))}
        {[1.15, 1.6].map((y, i) => (
          <B key={`b${i}`} p={[(i ? 0.12 : -0.12) * iw, y + 0.13, 0.03]} s={[Math.min(0.28, iw * 0.4), 0.24, 0.12]} c={i ? '#1f2124' : '#a07a55'} r={0.5} />
        ))}
        {led(2.0 - 0.02, 'led2')}
      </>
    );
  } else if (kind === 'cajones') {
    inside = (
      <>
        {drawers(3, 0.9)}
        {[0, 1, 2].map((i) => <C key={i} p={[-iw * 0.3 + i * 0.09, 0.98, 0.05]} r={0.025} h={0.13 - i * 0.02} c={['#2b2d31', '#c9b28a', '#e8dbd3'][i]} m={0.3} />)}
        {[1.4, 1.85].map((y, i) => shelf(y, `s${i}`))}
        {folded(1.42, 3, 'f1')}
        {folded(1.87, 2, 'f2')}
        {led(1.38, 'led2')}
      </>
    );
  } else {
    const ys = [0.45, 0.85, 1.25, 1.65, 2.05];
    inside = (
      <>
        {ys.map((y, i) => shelf(y, `s${i}`))}
        {ys.slice(0, 4).map((y, i) => folded(y + 0.012, 2, `f${i}`))}
        {led(ys[3] - 0.02, 'led2')}
      </>
    );
  }
  return (
    <>
      {[-1, 1].map((sx) => <B key={sx} p={[sx * (w / 2 - t / 2), h / 2, 0]} s={[t, h, d]} c={shade(c, 0.9)} />)}
      <B p={[0, h - t / 2, 0]} s={[w, t, d]} c={c} />
      <B p={[0, 0.04, -0.02]} s={[w, 0.08, d - 0.04]} c={shade(c, 0.6)} />
      <B p={[0, h / 2, -d / 2 + 0.005]} s={[iw, h, 0.01]} c={shade(c, 0.8)} />
      {led(h - t - 0.01, 'led')}
      {inside}
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

/** Upholstered sofa or armchair: slim wooden legs, a frame, loose seat and back cushions, rounded arms and a pair of
 * accent cushions on a sofa. */
const sofaDims = (w: number, d: number, h: number) => {
  const leg = 0.1;
  const arm = Math.min(0.2, w / 6);
  const seatH = Math.min(0.45, h * 0.55);
  const back = Math.min(0.16, d * 0.18);
  return { leg, arm, seatH, back, baseH: seatH - leg - 0.14 };
};

const sofa: Builder = ({ w, d, h, c }) => {
  const { leg, arm, seatH, back, baseH } = sofaDims(w, d, h);
  const iw = w - 2 * arm;
  const seats = Math.max(1, Math.round(iw / 0.7));
  const sw = iw / seats;
  const frame = shade(c, 0.86);
  const backFront = -d / 2 + 2 * back;
  const cushionD = d / 2 - 0.02 - backFront;
  const bh = h - seatH - 0.03;
  return (
    <>
      {taperedLegs(w - 0.06, d - 0.06, leg, WOOD_DARK, 0.04)}
      <RB p={[0, leg + baseH / 2, 0]} s={[w, baseH, d]} c={frame} rad={0.03} r={0.95} />
      <RB p={[0, leg + (h - leg) / 2, -d / 2 + back / 2]} s={[w, h - leg, back]} c={frame} rad={0.04} r={0.95} />
      {Array.from({ length: seats }, (_, i) => {
        const x = -iw / 2 + sw * (i + 0.5);
        return (
          <group key={i}>
            <RB p={[x, leg + baseH + 0.07, backFront + cushionD / 2]} s={[sw - 0.012, 0.14, cushionD]} c={c} rad={0.05} r={1} />
            <RB p={[x, seatH + bh / 2, -d / 2 + back * 1.5]} s={[sw - 0.02, bh, back]} rot={[-0.14, 0, 0]} c={c} rad={0.06} r={1} />
          </group>
        );
      })}
      {[-1, 1].map((sx) => <RB key={sx} p={[sx * (w / 2 - arm / 2), leg + (seatH + 0.2 - leg) / 2, 0]} s={[arm, seatH + 0.2 - leg, d]} c={c} rad={0.06} r={1} />)}
      {seats > 1 && [-1, 1].map((sx) => (
        <RB key={`a${sx}`} p={[sx * (iw / 2 - 0.26), seatH + 0.24, backFront + 0.08]} s={[0.42, 0.4, 0.12]} rot={[-0.25, sx * 0.3, sx * 0.06]} c={shade(c, 1.3)} rad={0.05} r={1} />
      ))}
    </>
  );
};

const sofaL: Builder = ({ w, d, h, c }) => {
  const chaise = Math.min(0.9, w / 2);
  const main = Math.min(0.95, d);
  const { leg, arm, baseH } = sofaDims(w, main, h);
  const len = d - main;
  const x = w / 2 - chaise / 2;
  return (
    <>
      <group position={[0, 0, -d / 2 + main / 2]}>{sofa({ w, d: main, h, c })}</group>
      {[-1, 1].map((sx) => <C key={sx} p={[x + sx * (chaise / 2 - 0.06), leg / 2, d / 2 - 0.06]} r={0.014} top={0.022} h={leg} c={WOOD_DARK} seg={12} />)}
      <RB p={[x, leg + baseH / 2, main / 2]} s={[chaise, baseH, len]} c={shade(c, 0.86)} rad={0.03} r={0.95} />
      <RB p={[x - arm / 2, leg + baseH + 0.07, main / 2 + 0.01]} s={[chaise - arm - 0.012, 0.14, len - 0.02]} c={c} rad={0.05} r={1} />
      <RB p={[w / 2 - arm / 2, leg + 0.25, main / 2]} s={[arm, 0.5, len]} c={c} rad={0.06} r={1} />
    </>
  );
};

const coffeeTable: Builder = ({ w, d, h, c }) => (
  <>
    <RB p={[0, h - 0.025, 0]} s={[w, 0.05, d]} c={c} rad={0.02} r={0.45} />
    <RB p={[0, 0.14, 0]} s={[w - 0.12, 0.025, d - 0.12]} c={shade(c, 0.85)} rad={0.008} r={0.6} />
    {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
      <C key={i} p={[sx * (w / 2 - 0.06), (h - 0.05) / 2, sz * (d / 2 - 0.06)]} r={0.012} h={h - 0.05} c={DARK} m={0.6} rough={0.35} seg={10} />
    ))}
  </>
);

const chairAt = (x: number, z: number, ry: number, c: string, key?: string | number, w = 0.45, d = 0.48, h = 0.88) => (
  <group key={key} position={[x, 0, z]} rotation={[0, ry, 0]}>
    {chair({ w, d, h, c })}
  </group>
);

/** Dining chair: wooden frame on round tapered legs, an upholstered seat and backrest. */
const chair: Builder = ({ w, d, h, c }) => {
  const seat = 0.46;
  const post = -d / 2 + 0.035;
  return (
    <>
      {[-1, 1].map((sx) => <C key={`f${sx}`} p={[sx * (w / 2 - 0.04), (seat - 0.05) / 2, d / 2 - 0.05]} r={0.012} top={0.018} h={seat - 0.05} c={WOOD} seg={10} />)}
      {[-1, 1].map((sx) => <C key={`b${sx}`} p={[sx * (w / 2 - 0.04), h / 2, post]} r={0.012} top={0.016} h={h} c={WOOD} rot={[-0.06, 0, 0]} seg={10} />)}
      <RB p={[0, seat - 0.07, 0.01]} s={[w - 0.04, 0.04, d - 0.06]} c={WOOD} rad={0.01} r={0.6} />
      <RB p={[0, seat - 0.025, 0.02]} s={[w, 0.06, d - 0.04]} c={c} rad={0.025} r={1} />
      <RB p={[0, h - 0.13, post - 0.01]} s={[w - 0.02, 0.2, 0.035]} rot={[-0.1, 0, 0]} c={c} rad={0.015} r={1} />
    </>
  );
};

const table: Builder = ({ w, d, h, c, item }) => {
  const seats = item?.withChairs ? item.seats ?? 0 : 0;
  const per = Math.max(1, Math.floor(seats / 2));
  return (
    <>
      <RB p={[0, h - 0.02, 0]} s={[w, 0.04, d]} c={c} rad={0.015} r={0.5} />
      <B p={[0, h - 0.07, 0]} s={[w - 0.2, 0.06, d - 0.2]} c={shade(c, 0.8)} />
      {taperedLegs(w, d, h - 0.04, shade(c, 0.8), 0.1, 0.03)}
      {seats > 0 && Array.from({ length: per }, (_, i) => {
        const x = -w / 2 + (w * (i + 0.5)) / per;
        return [chairAt(x, -d / 2 - 0.18, Math.PI, shade(c, 0.85), `n${i}`), chairAt(x, d / 2 + 0.18, 0, shade(c, 0.85), `s${i}`)];
      })}
    </>
  );
};

/** Base kitchen unit: recessed toe-kick, door fronts with slim bar handles, a stone top overhanging the front. */
const counter = (extra?: (p: P) => ReactElement): Builder => (p) => {
  const { w, d, h, c } = p;
  const n = Math.max(1, Math.round(w / 0.6));
  const dw = w / n;
  const body = h - 0.14;
  return (
    <>
      <B p={[0, 0.05, -0.04]} s={[w, 0.1, d - 0.08]} c={DARK} />
      <B p={[0, 0.1 + body / 2, -0.01]} s={[w, body, d - 0.04]} c={shade(c, 0.92)} />
      {Array.from({ length: n }, (_, i) => (
        <group key={i}>
          <RB p={[-w / 2 + dw * (i + 0.5), 0.1 + body / 2, d / 2 - 0.02]} s={[dw - 0.006, body - 0.006, 0.02]} c={c} rad={0.004} r={0.5} />
          <B p={[-w / 2 + dw * (i + 0.5), 0.1 + body - 0.06, d / 2 + 0.004]} s={[dw * 0.5, 0.012, 0.014]} c={STEEL} m={0.85} r={0.25} />
        </group>
      ))}
      <RB p={[0, h - 0.02, 0.01]} s={[w, 0.04, d + 0.02]} c={STONE} rad={0.01} r={0.3} />
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
    <RB p={[0, h / 2, 0]} s={[w, h, d]} c={c} m={0.55} r={0.28} rad={0.03} />
    <B p={[0, h * 0.62, d / 2 + 0.001]} s={[w - 0.01, 0.008, 0.004]} c={shade(c, 0.55)} />
    <B p={[w * 0.12, h - 0.01 - (h * 0.38) / 2, d / 2 + 0.001]} s={[0.006, h * 0.38 - 0.03, 0.004]} c={shade(c, 0.55)} />
    <C p={[w * 0.12 - 0.04, h * 0.82, d / 2 + 0.03]} r={0.011} h={0.32} c={STEEL} m={0.9} rough={0.2} seg={10} />
    <C p={[w * 0.12 + 0.04, h * 0.82, d / 2 + 0.03]} r={0.011} h={0.32} c={STEEL} m={0.9} rough={0.2} seg={10} />
    <C p={[w / 2 - 0.06, h * 0.35, d / 2 + 0.03]} r={0.011} h={0.4} c={STEEL} m={0.9} rough={0.2} seg={10} />
    <B p={[w * 0.3, h * 0.82, d / 2 + 0.003]} s={[0.12, 0.16, 0.004]} c={'#1b1d20'} r={0.1} e={'#203a55'} />
  </>
);

/** Toilet: rounded cistern with a flush button, a tapered bowl, the seat ring and the lid up. */
const toilet: Builder = ({ w, d, h, c }) => {
  const seatY = 0.42;
  return (
    <>
      <RB p={[0, h * 0.72, -d / 2 + d * 0.12]} s={[w, h * 0.55, d * 0.22]} c={c} rad={0.04} r={0.2} />
      <C p={[0, h - 0.002, -d / 2 + d * 0.12]} r={0.025} h={0.01} c={STEEL} m={0.9} rough={0.2} />
      <mesh position={[0, seatY / 2, d * 0.07]} scale={[1, 1, 1.3]} castShadow receiveShadow>
        <cylinderGeometry args={[w * 0.44, w * 0.3, seatY - 0.02, 28]} />
        <meshStandardMaterial color={c} roughness={0.2} />
      </mesh>
      <mesh position={[0, seatY, d * 0.08]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1.3, 1]} castShadow>
        <torusGeometry args={[w * 0.36, 0.035, 10, 28]} />
        <meshStandardMaterial color={WHITE} roughness={0.3} />
      </mesh>
      <mesh position={[0, seatY + 0.005, d * 0.08]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1.3, 1]}>
        <circleGeometry args={[w * 0.33, 24]} />
        <meshStandardMaterial color={'#cfdade'} roughness={0.1} />
      </mesh>
      <mesh position={[0, seatY + w * 0.36, -d / 2 + d * 0.25]} rotation={[-0.15, 0, 0]} scale={[1, 1.3, 1]} castShadow>
        <cylinderGeometry args={[w * 0.4, w * 0.4, 0.025, 28]} />
        <meshStandardMaterial color={WHITE} roughness={0.3} />
      </mesh>
    </>
  );
};

/** Floating vanity (wood drawers) with a stone top, white vessel basins and tall mixer taps. */
const basin: Builder = ({ w, d, h, c, item }) => {
  const n = item?.double ? 2 : 1;
  const top = h - 0.12;
  const body = Math.min(0.45, top - 0.2);
  return (
    <>
      <RB p={[0, top - body / 2, -0.02]} s={[w - 0.02, body, d - 0.04]} c={'#b08a63'} rad={0.01} r={0.6} />
      <B p={[0, top - body / 2, d / 2 - 0.035]} s={[w - 0.06, 0.006, 0.006]} c={shade('#b08a63', 0.6)} />
      <RB p={[0, top + 0.015, 0]} s={[w, 0.03, d]} c={c} rad={0.008} r={0.3} />
      {Array.from({ length: n }, (_, i) => {
        const x = -w / 2 + (w * (i + 0.5)) / n;
        const br = Math.min(0.2, w / n / 2 - 0.06);
        return (
          <group key={i}>
            <mesh position={[x, top + 0.09, 0.03]} scale={[1, 1, 0.78]} castShadow>
              <cylinderGeometry args={[br, br * 0.7, 0.12, 28]} />
              <meshStandardMaterial color={WHITE} roughness={0.15} />
            </mesh>
            <mesh position={[x, top + 0.151, 0.03]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.78, 1]}>
              <circleGeometry args={[br - 0.012, 28]} />
              <meshStandardMaterial color={'#dfe4e6'} roughness={0.1} />
            </mesh>
            <C p={[x, top + 0.17, -d / 2 + 0.06]} r={0.012} h={0.28} c={STEEL} m={0.9} rough={0.2} seg={10} />
            <C p={[x, top + 0.3, -d / 2 + 0.11]} r={0.01} h={0.11} c={STEEL} m={0.9} rough={0.2} rot={[Math.PI / 2, 0, 0]} seg={10} />
          </group>
        );
      })}
    </>
  );
};

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

/** Telescopic sliding gate: framed leaves of horizontal slats (celosía) on two tracks, slid aside when open. */
const slidingGate: Builder = ({ w, d, h, c, open }) => {
  const slat = 0.1;
  const gap = 0.025;
  const rows = Math.floor((h - 0.08) / (slat + gap));
  return (
    <>
      {gatePanels(w, open === true).map((pn, i) => {
        const cx = (pn.x0 + pn.x1) / 2;
        const lw = pn.x1 - pn.x0;
        const z = (pn.track === 0 ? -1 : 1) * (d / 4);
        return (
          <group key={i} position={[cx, 0, z]}>
            <B p={[-lw / 2 + 0.02, h / 2, 0]} s={[0.04, h, 0.04]} c={c} />
            <B p={[lw / 2 - 0.02, h / 2, 0]} s={[0.04, h, 0.04]} c={c} />
            <B p={[0, h - 0.02, 0]} s={[lw, 0.04, 0.04]} c={c} />
            {Array.from({ length: rows }, (_, r) => (
              <B key={r} p={[0, 0.06 + r * (slat + gap) + slat / 2, 0]} s={[lw - 0.04, slat, 0.025]} c={c} />
            ))}
            <C p={[-lw / 2 + 0.15, 0.04, 0]} r={0.035} h={0.03} c={METAL} />
          </group>
        );
      })}
    </>
  );
};

/** Street lamp: pole, arm over the street (+y) and the lamp head. */
const streetLamp: Builder = ({ d, h, c }) => (
  <>
    <C p={[0, h / 2, -d / 2 + 0.1]} r={0.06} top={0.045} h={h} c={c} />
    <B p={[0, h - 0.05, 0]} s={[0.06, 0.06, d - 0.1]} c={c} />
    <B p={[0, h - 0.12, d / 2 - 0.15]} s={[0.25, 0.08, 0.35]} c={'#f2e6c9'} />
  </>
);

const bench: Builder = ({ w, d, h, c }) => (
  <>
    {Array.from({ length: 4 }, (_, i) => <B key={i} p={[0, h - 0.02, -d / 2 + (d * (i + 0.5)) / 4]} s={[w, 0.035, d / 4 - 0.02]} c={c} />)}
    {[-1, 1].map((sx) => <B key={sx} p={[sx * (w / 2 - 0.1), (h - 0.04) / 2, 0]} s={[0.06, h - 0.04, d - 0.05]} c={DARK} />)}
  </>
);

/** Sedan, length along x with the front at +x: rounded body, tinted glasshouse under the roof, wheels with rims. */
const car: Builder = ({ w, d, h, c }) => {
  const wheelR = Math.min(0.33, h * 0.23);
  const body = h * 0.42;
  const sill = wheelR * 0.55;
  const cabin = h - sill - body;
  return (
    <>
      <RB p={[0, sill + body / 2, 0]} s={[w, body, d]} c={c} rad={0.14} r={0.25} m={0.6} />
      <RB p={[-w * 0.05, sill + body + cabin / 2 - 0.04, 0]} s={[w * 0.5, cabin + 0.08, d * 0.86]} c={'#1d2a33'} rad={0.16} r={0.08} m={0.5} />
      <RB p={[-w * 0.07, h - 0.025, 0]} s={[w * 0.38, 0.05, d * 0.8]} c={c} rad={0.025} r={0.25} m={0.6} />
      {[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz], i) => (
        <group key={i} position={[sx * w * 0.32, wheelR, sz * (d / 2 - 0.12)]}>
          <C p={[0, 0, 0]} r={wheelR} h={0.22} c={'#161616'} rough={0.9} rot={[Math.PI / 2, 0, 0]} seg={24} />
          <C p={[0, 0, sz * 0.006]} r={wheelR * 0.62} h={0.222} c={STEEL} m={0.85} rough={0.3} rot={[Math.PI / 2, 0, 0]} seg={20} />
        </group>
      ))}
      <B p={[w / 2 - 0.01, sill + body * 0.45, 0]} s={[0.03, body * 0.3, d * 0.42]} c={DARK} r={0.5} />
      {[-1, 1].map((sz) => <RB key={sz} p={[w / 2 - 0.03, sill + body * 0.68, sz * (d / 2 - 0.22)]} s={[0.06, 0.07, 0.3]} c={'#fff6d8'} rad={0.02} r={0.2} />)}
      {[-1, 1].map((sz) => <RB key={`t${sz}`} p={[-w / 2 + 0.03, sill + body * 0.68, sz * (d / 2 - 0.22)]} s={[0.06, 0.07, 0.34]} c={'#a01818'} rad={0.02} r={0.3} />)}
      {[-1, 1].map((sz) => <RB key={`m${sz}`} p={[w * 0.17, sill + body + 0.05, sz * (d / 2 + 0.05)]} s={[0.12, 0.08, 0.1]} c={c} rad={0.02} r={0.3} m={0.5} />)}
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

/** Deterministic pseudo-random numbers in [0, 1) from a seed (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable number from a string (a piece's id), so every tree keeps its own shape. */
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// --- Mirrors: a light silver face that reflects a soft studio room, so it never reads as a dark screen ---

let mirrorEnv: { gl: THREE.WebGLRenderer; tex: THREE.Texture } | null = null;

function MirrorFace({ p, s, c }: { p: V3; s: V3; c: string }) {
  const gl = useThree((st) => st.gl);
  const env = useMemo(() => {
    if (mirrorEnv?.gl !== gl) {
      const pmrem = new THREE.PMREMGenerator(gl);
      mirrorEnv = { gl, tex: pmrem.fromScene(new RoomEnvironment(), 0.02).texture };
      pmrem.dispose();
    }
    return mirrorEnv.tex;
  }, [gl]);
  return (
    <mesh position={p} receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} metalness={0.95} roughness={0.04} envMap={env} envMapIntensity={1.15} emissive={c} emissiveIntensity={0.22} />
    </mesh>
  );
}

const mirror: Builder = ({ w, d, h, c }) => {
  const f = 0.025; // thin frame
  const fc = '#9aa0a6';
  return (
    <>
      <B p={[0, h / 2, -d / 2 + 0.006]} s={[w, h, 0.012]} c={shade(fc, 0.7)} m={0.4} r={0.5} />
      {[-1, 1].map((sx) => <B key={`v${sx}`} p={[sx * (w / 2 - f / 2), h / 2, 0]} s={[f, h, d]} c={fc} m={0.3} r={0.35} />)}
      {[-1, 1].map((sy) => <B key={`h${sy}`} p={[0, h / 2 + sy * (h / 2 - f / 2), 0]} s={[w - 2 * f, f, d]} c={fc} m={0.3} r={0.35} />)}
      <MirrorFace p={[0, h / 2, d / 2 - 0.012]} s={[w - 2 * f, h - 2 * f, 0.006]} c={c} />
    </>
  );
};

// --- Glow (LED strips, fire): a soft additive halo, brightest in the middle ---

let glowTexture: THREE.Texture | null = null;
function glowMap(): THREE.Texture {
  if (glowTexture) return glowTexture;
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 64;
  const ctx = cv.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  glowTexture = new THREE.CanvasTexture(cv);
  return glowTexture;
}

function Glow({ p, s, c, o = 0.35, rot }: { p: V3; s: [number, number]; c: string; o?: number; rot?: V3 }) {
  const map = useMemo(glowMap, []);
  return (
    <mesh position={p} rotation={rot} renderOrder={2}>
      <planeGeometry args={s} />
      <meshBasicMaterial color={c} map={map} transparent opacity={o} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}

/** Bright, untonemapped emissive box (LEDs, neon). */
function Neon({ p, s, c, k = 2.2, rot }: { p: V3; s: V3; c: string; k?: number; rot?: V3 }) {
  return (
    <mesh position={p} rotation={rot}>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} emissive={c} emissiveIntensity={k} toneMapped={false} />
    </mesh>
  );
}

/** LED strip on a wall (back at −z): the strip and the light it washes on the wall. */
const ledStrip: Builder = ({ w, d, h, c }) => (
  <>
    <Neon p={[0, h / 2, 0]} s={[w, h, d]} c={c} />
    <Glow p={[0, h / 2, -d / 2 + 0.002]} s={[w + 0.6, 1.0]} c={c} o={0.8} />
  </>
);

// --- Entertainment centre ---

const BOOKS = ['#6d4c41', '#3f5e74', '#8a7a5c', '#a1887f', '#455a64', '#c8b89a'];

/** A few decorative objects on a shelf: books, a vase or a box (deterministic per slot). */
function shelfDecor(x: number, y: number, z: number, room: number, k: number) {
  const kind = k % 3;
  if (kind === 0) {
    const n = 4;
    return (
      <group key={`d${k}`}>
        {Array.from({ length: n }, (_, i) => (
          <B key={i} p={[x - room * 0.3 + i * 0.035, y + 0.11, z]} s={[0.03, 0.22 - (i % 2) * 0.03, 0.16]} c={BOOKS[(i + k) % BOOKS.length]} r={0.9} />
        ))}
      </group>
    );
  }
  if (kind === 1) return <C key={`d${k}`} p={[x, y + 0.09, z]} r={0.045} top={0.03} h={0.18} c={k % 2 ? '#d8cfc2' : '#5f6f63'} rough={0.4} />;
  return <B key={`d${k}`} p={[x + room * 0.15, y + 0.05, z]} s={[0.12, 0.1, 0.12]} c={'#b9a58a'} />;
}

const entertainment: Builder = ({ w, d, h, c }) => {
  const tw = Math.min(0.45, w / 5);
  const cab = Math.min(0.5, h * 0.27);
  const bridge = Math.min(0.3, h * 0.16);
  const t = 0.025;
  const nw = w - 2 * tw;
  const back = shade(c, 0.7);
  const nShelves = 3;
  const step = (h - cab) / nShelves;
  const slats = Math.max(4, Math.round(nw / 0.07));
  return (
    <>
      {/* Two towers with open shelves over a closed base */}
      {[-1, 1].map((sx) => {
        const cx = sx * (w / 2 - tw / 2);
        return (
          <group key={sx}>
            <B p={[cx - tw / 2 + t / 2, h / 2, 0]} s={[t, h, d]} c={c} />
            <B p={[cx + tw / 2 - t / 2, h / 2, 0]} s={[t, h, d]} c={c} />
            <B p={[cx, h / 2, -d / 2 + 0.01]} s={[tw - 2 * t, h, 0.02]} c={back} />
            <B p={[cx, cab / 2, 0]} s={[tw - 2 * t, cab, d - 0.02]} c={c} />
            <B p={[cx, cab / 2 + 0.02, d / 2 - 0.004]} s={[tw - 2 * t - 0.02, cab - 0.06, 0.01]} c={shade(c, 1.08)} />
            <B p={[cx - sx * (tw / 2 - 0.07), cab / 2 + 0.05, d / 2 + 0.008]} s={[0.012, 0.14, 0.012]} c={METAL} m={0.6} r={0.4} />
            {Array.from({ length: nShelves }, (_, i) => (
              <B key={i} p={[cx, cab + step * (i + 1) - t / 2, 0]} s={[tw - 2 * t, t, d - 0.02]} c={c} />
            ))}
            {Array.from({ length: nShelves }, (_, i) => shelfDecor(cx, cab + step * i + (i ? 0 : 0), 0, tw / 2 - t, i + (sx > 0 ? 1 : 0)))}
          </group>
        );
      })}
      {/* Low cabinet under the TV niche: two doors and a plinth */}
      <B p={[0, 0.04, -0.02]} s={[nw, 0.08, d - 0.06]} c={shade(c, 0.55)} />
      <B p={[0, (cab + 0.08) / 2, 0]} s={[nw, cab - 0.08, d]} c={c} />
      {[-1, 1].map((sx) => (
        <group key={`door${sx}`}>
          <B p={[(sx * nw) / 4, (cab + 0.08) / 2, d / 2 + 0.004]} s={[nw / 2 - 0.02, cab - 0.12, 0.008]} c={shade(c, 1.08)} />
          <B p={[sx * 0.08, (cab + 0.08) / 2, d / 2 + 0.014]} s={[0.012, 0.16, 0.012]} c={METAL} m={0.6} r={0.4} />
        </group>
      ))}
      {/* Slatted back of the niche */}
      <B p={[0, (cab + h - bridge) / 2, -d / 2 + 0.008]} s={[nw, h - bridge - cab, 0.016]} c={shade(c, 0.45)} />
      {Array.from({ length: slats }, (_, i) => (
        <B key={`s${i}`} p={[-nw / 2 + (nw * (i + 0.5)) / slats, (cab + h - bridge) / 2, -d / 2 + 0.024]} s={[nw / slats - 0.018, h - bridge - cab, 0.016]} c={back} />
      ))}
      {/* Bridge shelf on top, with a warm light strip under it */}
      <B p={[0, h - bridge + t / 2, 0]} s={[nw, t, d]} c={c} />
      <B p={[0, h - t / 2, 0]} s={[nw, t, d]} c={c} />
      <B p={[0, h - bridge / 2, -d / 2 + 0.01]} s={[nw, bridge, 0.02]} c={back} />
      <Neon p={[0, h - bridge - 0.004, d / 2 - 0.06]} s={[nw - 0.1, 0.006, 0.012]} c={'#ffd9a6'} k={1.2} />
      {shelfDecor(-nw * 0.3, h - bridge + t, 0, 0.1, 0)}
      {shelfDecor(nw * 0.05, h - bridge + t, 0, 0.1, 1)}
      {shelfDecor(nw * 0.32, h - bridge + t, 0, 0.1, 2)}
    </>
  );
};

/** Console lying flat: white shell, black core and a blue light line. */
const console_: Builder = ({ w, d, h, c }) => (
  <>
    <B p={[0, h * 0.5, 0]} s={[w, h * 0.38, d * 0.82]} c={DARK} r={0.4} />
    {[-1, 1].map((sy) => <B key={sy} p={[0, h * 0.5 + sy * h * 0.3, 0]} s={[w, h * 0.3, d]} c={c} r={0.35} />)}
    <Neon p={[0, h * 0.5, d * 0.41 + 0.002]} s={[w * 0.9, 0.006, 0.003]} c={'#4f9dff'} k={1.5} />
    <B p={[w * 0.32, 0.02, d / 2 + 0.12]} s={[0.15, 0.04, 0.1]} c={c} r={0.4} />
  </>
);

// --- Curtain: gathered fabric hanging from a rod ---

const curtain: Builder = ({ w, d, h, c }) => {
  const n = Math.max(3, Math.round(w / 0.09));
  const fold = w / n;
  return (
    <>
      <C p={[0, h - 0.03, -d / 2 + 0.03]} r={0.012} h={w + 0.1} c={METAL} m={0.7} rough={0.3} rot={[0, 0, Math.PI / 2]} />
      {[-1, 1].map((sx) => <S key={sx} p={[sx * (w / 2 + 0.05), h - 0.03, -d / 2 + 0.03]} r={0.022} c={METAL} />)}
      {Array.from({ length: n }, (_, i) => (
        <C key={i} p={[-w / 2 + fold * (i + 0.5), (h - 0.06) / 2 + 0.01, (i % 2 ? 0.25 : -0.05) * d]} r={fold * 0.62} h={h - 0.08} c={i % 2 ? c : shade(c, 0.9)} rough={0.95} seg={10} />
      ))}
    </>
  );
};

// --- Framed art ---

/** Flat triangle (apex up) on the picture plane: base centre (x, y), base width bw, height th. */
function Tri({ x, y, z, bw, th, c, e }: { x: number; y: number; z: number; bw: number; th: number; c: string; e?: boolean }) {
  return (
    <mesh position={[x, y + th / 3, z]} rotation={[-Math.PI / 2, 0, 0]} scale={[bw / Math.sqrt(3), 0.002, (th * 2) / 3]}>
      <cylinderGeometry args={[1, 1, 1, 3]} />
      <meshStandardMaterial color={c} roughness={0.85} emissive={e ? c : '#000000'} emissiveIntensity={e ? 1.4 : 0} toneMapped={!e} />
    </mesh>
  );
}

/** Flat disc on the picture plane. */
function Disc({ x, y, z, r, c, e }: { x: number; y: number; z: number; r: number; c: string; e?: boolean }) {
  return (
    <mesh position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[r, r, 0.002, 28]} />
      <meshStandardMaterial color={c} roughness={0.85} emissive={e ? c : '#000000'} emissiveIntensity={e ? 1.4 : 0} toneMapped={!e} />
    </mesh>
  );
}

const picture: Builder = ({ w, d, h, c, item }) => {
  const art = item?.art ?? 'abstracto';
  const f = Math.min(0.035, w * 0.06); // frame
  const mat = art === 'paisaje' || art === 'byn' ? Math.min(0.06, w * 0.09) : 0; // passe-partout
  const aw = w - 2 * f - 2 * mat;
  const ah = h - 2 * f - 2 * mat;
  const z0 = d / 2 - 0.004;
  const cy = h / 2;
  // Picture-plane helpers: (u, v) in [−0.5, 0.5] of the artwork, layers stack towards the viewer.
  const X = (u: number) => u * aw;
  const Y = (v: number) => cy + v * ah;
  const R = (u0: number, v0: number, u1: number, v1: number, col: string, layer: number, glow = false) => {
    const p: V3 = [X((u0 + u1) / 2), Y((v0 + v1) / 2), z0 + layer * 0.0012];
    const s: V3 = [(u1 - u0) * aw, (v1 - v0) * ah, 0.0012];
    return glow ? <Neon key={`${u0}${v0}${layer}`} p={p} s={s} c={col} k={1.3} /> : <B key={`${u0}${v0}${layer}`} p={p} s={s} c={col} r={0.85} />;
  };
  const z = (layer: number) => z0 + layer * 0.0012;
  let artwork: ReactElement;
  if (art === 'paisaje') {
    artwork = (
      <>
        {R(-0.5, -0.05, 0.5, 0.5, '#bcd3df', 1)}
        {R(-0.5, 0.2, 0.5, 0.5, '#d6e3ea', 2)}
        <Disc x={X(0.27)} y={Y(0.27)} z={z(3)} r={ah * 0.09} c={'#f2dcae'} />
        <Tri x={X(-0.22)} y={Y(-0.12)} z={z(4)} bw={aw * 0.8} th={ah * 0.5} c={'#8ea1ad'} />
        <Tri x={X(0.25)} y={Y(-0.12)} z={z(5)} bw={aw * 0.7} th={ah * 0.38} c={'#7b8f9c'} />
        {R(-0.5, -0.5, 0.5, -0.08, '#7f9a69', 6)}
        <Tri x={X(-0.1)} y={Y(-0.2)} z={z(7)} bw={aw * 1.1} th={ah * 0.16} c={'#6c8858'} />
        {R(-0.5, -0.5, 0.5, -0.3, '#a7b56f', 8)}
        {R(-0.5, -0.36, 0.5, -0.33, '#c2c98f', 9)}
      </>
    );
  } else if (art === 'byn') {
    artwork = (
      <>
        {R(-0.5, -0.5, 0.5, 0.5, '#d9d9d6', 1)}
        {R(-0.5, 0.15, 0.5, 0.5, '#ececea', 2)}
        {R(-0.5, -0.5, 0.5, -0.12, '#7d7d7b', 3)}
        {R(-0.5, -0.5, 0.5, -0.3, '#4a4a49', 4)}
        <Tri x={X(0.18)} y={Y(-0.12)} z={z(5)} bw={aw * 0.55} th={ah * 0.42} c={'#2b2b2b'} />
        {R(-0.32, -0.12, -0.3, 0.18, '#1d1d1d', 6)}
        <Disc x={X(-0.31)} y={Y(0.2)} z={z(7)} r={aw * 0.12} c={'#262626'} />
        <Disc x={X(-0.25)} y={Y(0.32)} z={z(8)} r={ah * 0.05} c={'#fafaf8'} />
      </>
    );
  } else if (art === 'gamer') {
    artwork = (
      <>
        {R(-0.5, -0.5, 0.5, 0.5, '#141522', 1)}
        {R(-0.5, -0.5, 0.5, -0.15, '#24164a', 2)}
        {Array.from({ length: 5 }, (_, i) => R(-0.5, -0.47 + i * 0.07, 0.5, -0.462 + i * 0.07, '#7b3cff', 3, true))}
        <Tri x={X(-0.2)} y={Y(0.12)} z={z(4)} bw={aw * 0.28} th={ah * 0.18} c={'#2bff9a'} e />
        <Tri x={X(-0.2)} y={Y(0.145)} z={z(5)} bw={aw * 0.16} th={ah * 0.105} c={'#141522'} />
        <Disc x={X(0.2)} y={Y(0.2)} z={z(4)} r={aw * 0.13} c={'#ff3b6b'} e />
        <Disc x={X(0.2)} y={Y(0.2)} z={z(5)} r={aw * 0.08} c={'#141522'} />
        {R(-0.32, -0.06, -0.08, 0.0, '#38b6ff', 4, true)}
        {R(-0.23, -0.15, -0.17, 0.09, '#38b6ff', 5, true)}
        {R(0.08, -0.12, 0.32, 0.06, '#ff4fd8', 4, true)}
        {R(0.12, -0.08, 0.28, 0.02, '#141522', 5)}
        {R(-0.42, 0.36, 0.42, 0.42, '#ffd23f', 4, true)}
      </>
    );
  } else {
    artwork = (
      <>
        {R(-0.5, -0.5, 0.5, 0.5, '#efe5d3', 1)}
        {R(-0.5, -0.5, 0.05, 0.05, '#e3b79c', 2)}
        <Disc x={X(0.12)} y={Y(0.1)} z={z(3)} r={Math.min(aw, ah) * 0.27} c={'#c0623d'} />
        {R(-0.38, -0.42, 0.42, -0.3, '#5b3a29', 4)}
        {R(0.18, -0.3, 0.4, 0.42, '#d9a440', 5)}
        {R(-0.42, 0.22, -0.12, 0.42, '#8f4a2f', 6)}
      </>
    );
  }
  return (
    <>
      <B p={[0, cy, 0]} s={[w, h, d - 0.006]} c={c} r={0.6} />
      {mat > 0 && <B p={[0, cy, z0 - 0.001]} s={[w - 2 * f, h - 2 * f, 0.002]} c={'#f7f5f0'} r={0.9} />}
      {artwork}
    </>
  );
};

// --- Floating shelf with collectibles ---

const FIGURES = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#8e24aa', '#fb8c00', '#00acc1'];

const collectiblesShelf: Builder = ({ w, d, h, c }) => {
  const t = 0.03;
  const levels = [0, h * 0.55];
  const n = Math.max(3, Math.round(w / 0.17));
  return (
    <>
      {levels.map((y, li) => (
        <group key={li}>
          <B p={[0, y + t / 2, 0]} s={[w, t, d]} c={c} r={0.5} />
          {Array.from({ length: n }, (_, i) => {
            const x = -w / 2 + (w * (i + 0.5)) / n;
            const col = FIGURES[(i * 3 + li * 2) % FIGURES.length];
            const kind = (i + li) % 4;
            const base = y + t;
            if (kind === 0) {
              return (
                <group key={i}>
                  <C p={[x, base + 0.005, 0]} r={0.04} h={0.01} c={DARK} />
                  <C p={[x, base + 0.07, 0]} r={0.028} top={0.022} h={0.12} c={col} rough={0.4} />
                  <S p={[x, base + 0.16, 0]} r={0.035} c={col === '#fdd835' ? '#f1c27d' : shade(col, 1.25)} />
                </group>
              );
            }
            if (kind === 1) return <B key={i} p={[x, base + 0.09, -d * 0.15]} s={[0.13, 0.18, 0.02]} c={col} r={0.5} />;
            if (kind === 2) {
              return (
                <group key={i}>
                  <S p={[x, base + 0.06, 0]} r={0.06} c={col} sc={[1, 0.95, 1]} />
                  <B p={[x, base + 0.065, 0.045]} s={[0.07, 0.025, 0.02]} c={DARK} r={0.2} />
                </group>
              );
            }
            return <B key={i} p={[x, base + 0.05, 0]} s={[0.09, 0.1, 0.09]} c={col} r={0.6} />;
          })}
        </group>
      ))}
    </>
  );
};

// --- Bathroom ---

/** Built-in jacuzzi: tiled apron, wide deck, water, jets, headrests and a chrome spout. */
const jacuzzi: Builder = ({ w, d, h, c }) => {
  const rim = Math.min(0.12, d * 0.15);
  const iw = w - 2 * rim;
  const id = d - 2 * rim;
  const water = h - 0.1;
  const tiles = Math.max(3, Math.round(w / 0.3));
  return (
    <>
      <B p={[0, 0.04, 0.02]} s={[w - 0.04, 0.08, d - 0.08]} c={shade(c, 0.75)} />
      {/* Walls and deck */}
      <B p={[0, (h + 0.08) / 2, -d / 2 + rim / 2]} s={[w, h - 0.08, rim]} c={c} r={0.3} />
      <B p={[0, (h + 0.08) / 2, d / 2 - rim / 2]} s={[w, h - 0.08, rim]} c={c} r={0.3} />
      <B p={[-w / 2 + rim / 2, (h + 0.08) / 2, 0]} s={[rim, h - 0.08, id]} c={c} r={0.3} />
      <B p={[w / 2 - rim / 2, (h + 0.08) / 2, 0]} s={[rim, h - 0.08, id]} c={c} r={0.3} />
      <B p={[0, h - 0.015, -d / 2 + rim / 2]} s={[w, 0.03, rim]} c={shade(c, 1.04)} r={0.2} />
      <B p={[0, h - 0.015, d / 2 - rim / 2]} s={[w, 0.03, rim]} c={shade(c, 1.04)} r={0.2} />
      <B p={[-w / 2 + rim / 2, h - 0.015, 0]} s={[rim, 0.03, id]} c={shade(c, 1.04)} r={0.2} />
      <B p={[w / 2 - rim / 2, h - 0.015, 0]} s={[rim, 0.03, id]} c={shade(c, 1.04)} r={0.2} />
      {/* Tile joints on the apron */}
      {Array.from({ length: tiles - 1 }, (_, i) => (
        <B key={`j${i}`} p={[-w / 2 + (w * (i + 1)) / tiles, (h + 0.08) / 2 - 0.02, d / 2 + 0.001]} s={[0.004, h - 0.14, 0.002]} c={shade(c, 0.82)} />
      ))}
      <B p={[0, (h + 0.08) / 2 - 0.02, d / 2 + 0.001]} s={[w, 0.004, 0.002]} c={shade(c, 0.82)} />
      {/* Basin and water */}
      <B p={[0, 0.12, 0]} s={[iw, 0.04, id]} c={'#eef8fb'} r={0.2} />
      {[-1, 1].map((sz) => [-0.3, 0, 0.3].map((u) => (
        <C key={`jet${sz}${u}`} p={[u * iw, water - 0.18, sz * (id / 2 - 0.006)]} r={0.025} h={0.012} c={STEEL} m={0.55} rough={0.22} rot={[Math.PI / 2, 0, 0]} />
      )))}
      <mesh position={[0, (water + 0.14) / 2, 0]}>
        <boxGeometry args={[iw - 0.002, water - 0.14, id - 0.002]} />
        <meshStandardMaterial color={'#49b0e6'} transparent opacity={0.5} roughness={0.05} metalness={0} emissive={'#1d79b0'} emissiveIntensity={0.35} depthWrite={false} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <C key={`b${i}`} p={[(((i * 37) % 10) / 10 - 0.45) * iw * 0.8, water + 0.002, (((i * 53) % 10) / 10 - 0.45) * id * 0.7]} r={0.012 + (i % 3) * 0.006} h={0.004} c={'#ffffff'} rough={0.3} e={'#ffffff'} />
      ))}
      {/* Headrests at both ends, spout and controls on the back deck */}
      {[-1, 1].map((sx) => (
        <B key={`hr${sx}`} p={[sx * (iw / 2 - 0.08), h + 0.01, 0]} s={[0.1, 0.06, Math.min(0.32, id * 0.6)]} c={'#7d868c'} r={0.9} />
      ))}
      <C p={[0, h + 0.05, -d / 2 + rim / 2]} r={0.018} h={0.1} c={STEEL} m={0.55} rough={0.22} />
      <B p={[0, h + 0.1, -d / 2 + rim / 2 + 0.06]} s={[0.04, 0.025, 0.14]} c={STEEL} m={0.55} r={0.22} />
      {[0.18, 0.26].map((x) => <C key={x} p={[x, h + 0.012, -d / 2 + rim / 2]} r={0.022} h={0.02} c={STEEL} m={0.55} rough={0.22} />)}
    </>
  );
};

/** Walk-in rain shower: low tray, one fixed glass panel on the +x side, wall column and a rain head on an arm. */
const shower: Builder = ({ w, d, h, c }) => {
  const head = Math.min(0.3, w * 0.36);
  const armZ = -d / 2 + Math.min(0.45, d * 0.5);
  return (
    <>
      <B p={[0, 0.02, 0]} s={[w, 0.04, d]} c={WHITE} r={0.3} />
      <B p={[0, 0.041, -d / 2 + 0.12]} s={[w - 0.12, 0.003, 0.05]} c={STEEL} m={0.5} r={0.3} />
      {/* Fixed glass panel with a thin profile and a stabiliser bar to the wall */}
      <mesh position={[w / 2 - 0.01, (h - 0.05) / 2 + 0.04, 0]}>
        <boxGeometry args={[0.01, h - 0.05, d - 0.02]} />
        <meshStandardMaterial color={c} transparent opacity={0.22} roughness={0.05} metalness={0.1} depthWrite={false} />
      </mesh>
      <B p={[w / 2 - 0.01, 0.06, 0]} s={[0.02, 0.03, d - 0.02]} c={STEEL} m={0.55} r={0.22} />
      <B p={[w / 2 - 0.01, h - 0.02, -0.05]} s={[0.015, 0.015, d - 0.1]} c={STEEL} m={0.55} r={0.22} />
      {/* Column, mixer and hand shower on the back wall */}
      <C p={[-w * 0.15, (h + 0.9) / 2, -d / 2 + 0.03]} r={0.012} h={h - 0.9} c={STEEL} m={0.55} rough={0.22} />
      <C p={[-w * 0.15, 1.1, -d / 2 + 0.02]} r={0.06} h={0.03} c={STEEL} m={0.55} rough={0.22} rot={[Math.PI / 2, 0, 0]} />
      <B p={[-w * 0.15, 1.1, -d / 2 + 0.06]} s={[0.025, 0.06, 0.05]} c={STEEL} m={0.55} r={0.22} />
      <B p={[-w * 0.15 + 0.06, 1.35, -d / 2 + 0.05]} s={[0.035, 0.18, 0.035]} c={STEEL} m={0.55} r={0.22} />
      {/* Arm out of the wall at the top and the wide rain head */}
      <B p={[-w * 0.15 / 2, h - 0.04, -d / 2 + 0.03]} s={[w * 0.15, 0.02, 0.02]} c={STEEL} m={0.55} r={0.22} />
      <B p={[0, h - 0.04, (-d / 2 + armZ) / 2]} s={[0.02, 0.02, armZ + d / 2]} c={STEEL} m={0.55} r={0.22} />
      <B p={[0, h - 0.065, armZ]} s={[head, 0.012, head]} c={STEEL} m={0.55} r={0.22} />
      <B p={[0, h - 0.072, armZ]} s={[head - 0.03, 0.003, head - 0.03]} c={'#8d9399'} m={0.6} r={0.4} />
      {/* A small built-in niche shelf with bottles */}
      <B p={[w * 0.25, 1.15, -d / 2 + 0.05]} s={[0.25, 0.015, 0.1]} c={WHITE} r={0.3} />
      {[0.17, 0.25, 0.33].map((x, i) => <C key={x} p={[w * x, 1.22, -d / 2 + 0.05]} r={0.02} h={0.12 - i * 0.02} c={['#e9e4da', '#9fb7a6', '#c9b28c'][i]} rough={0.4} />)}
    </>
  );
};

/** Towel rail with two towels draped over it (the colour is the towels'). */
const towelRail: Builder = ({ w, d, h, c }) => {
  const barY = h - 0.05;
  const tw = w * 0.42;
  return (
    <>
      {[-1, 1].map((sx) => <B key={sx} p={[sx * (w / 2 - 0.02), barY, -d / 2 + d / 2]} s={[0.02, 0.03, d]} c={STEEL} m={0.55} r={0.22} />)}
      <C p={[0, barY, d / 2 - 0.02]} r={0.01} h={w} c={STEEL} m={0.55} rough={0.22} rot={[0, 0, Math.PI / 2]} />
      {[-1, 1].map((sx, i) => {
        const col = i ? shade(c, 0.88) : c;
        const len = (h - 0.08) * (i ? 0.8 : 0.95);
        return (
          <group key={`t${sx}`}>
            <B p={[(sx * w) / 4.4, barY - len / 2, d / 2 - 0.035]} s={[tw, len, 0.02]} c={col} r={1} />
            <B p={[(sx * w) / 4.4, barY - len * 0.4, d / 2 - 0.005]} s={[tw, len * 0.8, 0.02]} c={col} r={1} />
            <B p={[(sx * w) / 4.4, barY - len * 0.68, d / 2 + 0.006]} s={[tw, 0.03, 0.003]} c={shade(col, 0.8)} r={1} />
          </group>
        );
      })}
    </>
  );
};

// --- Rooftop lounge ---

/** Fire pit: a low concrete drum with a steel bowl, lava stones, logs and a warm glowing fire. */
const firePit: Builder = ({ w, d, h, c }) => {
  const r = Math.min(w, d) / 2;
  return (
    <>
      <C p={[0, (h - 0.04) / 2, 0]} r={r * 0.92} top={r} h={h - 0.04} c={c} rough={0.95} seg={28} />
      <C p={[0, h - 0.02, 0]} r={r} h={0.04} c={'#2f3134'} m={0.6} rough={0.4} seg={28} />
      <C p={[0, h - 0.005, 0]} r={r * 0.78} h={0.012} c={'#3a2a24'} rough={1} seg={28} />
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return <S key={i} p={[Math.cos(a) * r * 0.6, h + 0.01, Math.sin(a) * r * 0.6]} r={0.04} c={'#444'} sc={[1, 0.6, 1]} />;
      })}
      {[0, 1, 2].map((i) => (
        <C key={`l${i}`} p={[0, h + 0.04, 0]} r={0.035} h={r * 1.0} c={'#5a3b26'} rough={1} rot={[Math.PI / 2, (i * Math.PI) / 3, 0.25]} seg={8} />
      ))}
      <Neon p={[0, h + 0.012, 0]} s={[r * 0.9, 0.006, r * 0.9]} c={'#ff7a1a'} k={1.6} />
      {[[0, 0, 0.32, 0.12], [0.07, 0.05, 0.22, 0.08], [-0.07, -0.04, 0.25, 0.09]].map(([x, z, fh, fr], i) => (
        <mesh key={`f${i}`} position={[x, h + 0.04 + fh / 2, z]}>
          <coneGeometry args={[fr, fh, 10]} />
          <meshStandardMaterial color={i ? '#ffb347' : '#ff8a2a'} emissive={i ? '#ffb347' : '#ff7a1a'} emissiveIntensity={2} transparent opacity={0.85} toneMapped={false} depthWrite={false} />
        </mesh>
      ))}
      <Glow p={[0, h + 0.2, 0]} s={[r * 2.2, r * 2.2]} c={'#ff9a40'} o={0.4} rot={[0, 0, 0]} />
      <Glow p={[0, 0.005, 0]} s={[r * 4.5, r * 4.5]} c={'#ff8a30'} o={0.25} rot={[-Math.PI / 2, 0, 0]} />
    </>
  );
};

const pouf: Builder = ({ w, d, h, c }) => {
  const r = Math.min(w, d) / 2;
  return (
    <>
      <C p={[0, (h - 0.05) / 2, 0]} r={r * 0.95} top={r} h={h - 0.05} c={c} rough={0.95} seg={24} />
      <S p={[0, h - 0.05, 0]} r={r} c={shade(c, 1.05)} sc={[1, 0.1 / r, 1]} />
      <C p={[0, h * 0.55, 0]} r={r * 1.005} h={0.02} c={shade(c, 0.8)} seg={24} />
    </>
  );
};

/** Vertical garden: a frame on the wall covered with leafy clusters of several greens and a few flowers. */
const verticalGarden: Builder = ({ w, d, h, c }) => {
  const cols = Math.max(3, Math.round(w / 0.13));
  const rows = Math.max(3, Math.round(h / 0.13));
  const rand = rng(cols * 131 + rows);
  const greens = [c, shade(c, 0.75), shade(c, 1.15), '#6f8f3e', '#3f6a3a', '#7d9a4a'];
  const cell = Math.min(w / cols, h / rows);
  return (
    <>
      <B p={[0, h / 2, -d / 2 + 0.015]} s={[w, h, 0.03]} c={'#3b3530'} />
      {Array.from({ length: rows * cols }, (_, k) => {
        const i = k % cols;
        const j = Math.floor(k / cols);
        const x = -w / 2 + cell / 2 + (w - cell) * (i / Math.max(1, cols - 1)) + (rand() - 0.5) * cell * 0.5;
        const y = cell / 2 + (h - cell) * (j / Math.max(1, rows - 1)) + (rand() - 0.5) * cell * 0.5;
        const r = cell * (0.6 + rand() * 0.3);
        const leaf = greens[Math.floor(rand() * greens.length)];
        const flower = rand() < 0.06;
        return (
          <group key={k}>
            <Blob p={[x, y, -d / 2 + 0.03 + r * 0.45]} r={r} sc={[1, 0.85, 0.6]} c={leaf} v={k} />
            {flower && <S p={[x, y + r * 0.2, -d / 2 + 0.03 + r * 0.95]} r={0.018} c={['#e8b9cc', '#f2dc8a', '#ffffff'][k % 3]} />}
          </group>
        );
      })}
    </>
  );
};

// --- Trees: trunk splitting into branches, a crown of irregular overlapping clusters ---

const blobCache = new Map<number, THREE.BufferGeometry>();

/** A lumpy unit sphere (icosahedron with deterministic noise on its vertices); `v` picks one of a few variants. */
function blobGeometry(v: number): THREE.BufferGeometry {
  const key = v % 6;
  const hit = blobCache.get(key);
  if (hit) return hit;
  const ico = new THREE.IcosahedronGeometry(1, 2);
  ico.deleteAttribute('normal');
  ico.deleteAttribute('uv');
  const g = mergeVertices(ico); // shared vertices: smooth shading instead of facets
  ico.dispose();
  const pos = g.attributes.position as THREE.BufferAttribute;
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    // Noise from the (shared) vertex position, so duplicated vertices move together and the surface stays closed.
    const n = Math.sin(p.x * 5.1 + key * 1.7) * Math.cos(p.y * 4.3 - key) * Math.sin(p.z * 4.7 + key * 0.6);
    const n2 = Math.sin((p.x + p.y * 0.7 + p.z * 0.3) * 9 + key * 2.3);
    p.multiplyScalar(1 + n * 0.16 + n2 * 0.05);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  g.computeVertexNormals();
  blobCache.set(key, g);
  return g;
}

function Blob({ p, r, sc = [1, 1, 1], c, v, rough = 0.92 }: { p: V3; r: number; sc?: V3; c: string; v: number; rough?: number }) {
  const geometry = useMemo(() => blobGeometry(v), [v]);
  return (
    <mesh geometry={geometry} position={p} scale={[r * sc[0], r * sc[1], r * sc[2]]} rotation={[0, v * 1.3, 0]} castShadow receiveShadow>
      <meshStandardMaterial color={c} roughness={rough} />
    </mesh>
  );
}

/** Colour with small deterministic changes of hue, saturation and lightness. */
function vary(hex: string, rand: () => number, amount = 1): string {
  const col = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  col.getHSL(hsl);
  col.setHSL(hsl.h + (rand() - 0.5) * 0.05 * amount, Math.min(1, hsl.s * (0.85 + rand() * 0.3)), hsl.l * (0.8 + rand() * 0.4 * amount));
  return '#' + col.getHexString();
}

const BARK = '#5b4433';

const tree: Builder = ({ w, d, h, c, item, seed = 1 }) => {
  const rand = rng(seed);
  const R = Math.min(w, d) / 2;
  const shrub = h < 1.5;
  const base = vary(c, rand, 0.6); // each tree its own green
  const leaf = (k: number) => {
    const t = rand();
    const target = t < 0.35 ? shade(base, 0.78) : t < 0.7 ? base : shade(vary(base, rand), 1.1);
    return k % 5 === 0 ? shade(base, 0.68) : target;
  };
  if (shrub) {
    const n = 6 + Math.floor(rand() * 3);
    return (
      <>
        {Array.from({ length: n }, (_, i) => {
          const a = (i / n) * Math.PI * 2 + rand() * 0.6;
          const dist = i === 0 ? 0 : R * (0.35 + rand() * 0.25);
          const r = R * (i === 0 ? 0.6 : 0.38 + rand() * 0.18);
          const y = Math.max(r * 0.75, h * (i === 0 ? 0.55 : 0.32 + rand() * 0.2));
          return <Blob key={i} p={[Math.cos(a) * dist, y, Math.sin(a) * dist]} r={r} sc={[1, Math.min(1, h / (2 * R)) * 0.85, 1]} c={leaf(i)} v={seed + i} />;
        })}
      </>
    );
  }
  const trunkH = h * (0.24 + rand() * 0.06);
  const crownH = h - trunkH;
  const tr = Math.max(0.06, R * 0.075);
  const nBranches = 3 + Math.floor(rand() * 2);
  const branches = Array.from({ length: nBranches }, (_, i) => {
    const a = (i / nBranches) * Math.PI * 2 + rand() * 0.8;
    const tilt = 0.55 + rand() * 0.35;
    const len = crownH * (0.32 + rand() * 0.1);
    return { a, tilt, len, end: [Math.cos(a) * Math.sin(tilt) * len, trunkH + Math.cos(tilt) * len, Math.sin(a) * Math.sin(tilt) * len] as V3 };
  });
  // Crown: one big flattened mass in the middle, a cluster at the end of every branch, a few filling the gaps and on top.
  const clusters: { p: V3; r: number }[] = [{ p: [0, trunkH + crownH * 0.5, 0], r: R * 0.62 }];
  for (const b of branches) clusters.push({ p: [b.end[0] * 1.05, b.end[1] + crownH * 0.05, b.end[2] * 1.05], r: R * (0.42 + rand() * 0.12) });
  const extra = 6 + Math.floor(rand() * 3);
  for (let i = 0; i < extra; i++) {
    const a = (i / extra) * Math.PI * 2 + rand() * 0.7;
    const dist = R * (0.3 + rand() * 0.35);
    clusters.push({ p: [Math.cos(a) * dist, trunkH + crownH * (0.32 + rand() * 0.45), Math.sin(a) * dist], r: R * (0.3 + rand() * 0.14) });
  }
  const flat = 0.7;
  // Keep the crown inside its box.
  for (const cl of clusters) {
    const out = Math.hypot(cl.p[0], cl.p[2]) + cl.r - R;
    if (out > 0) {
      const k = (Math.hypot(cl.p[0], cl.p[2]) - out) / Math.max(1e-6, Math.hypot(cl.p[0], cl.p[2]));
      cl.p[0] *= Math.max(0, k);
      cl.p[2] *= Math.max(0, k);
    }
    cl.p[1] = Math.min(cl.p[1], h - cl.r * flat);
  }
  const flowers = item?.flowers;
  const blooms = flowers
    ? Array.from({ length: 34 }, () => {
      const cl = clusters[Math.floor(rand() * clusters.length)];
      const a = rand() * Math.PI * 2;
      const up = 0.15 + rand() * 0.8;
      const s = Math.sqrt(1 - up * up);
      return { p: [cl.p[0] + Math.cos(a) * s * cl.r * 0.95, cl.p[1] + up * cl.r * flat * 0.95, cl.p[2] + Math.sin(a) * s * cl.r * 0.95] as V3, r: R * (0.035 + rand() * 0.03) };
    })
    : [];
  return (
    <>
      <C p={[0, trunkH / 2, 0]} r={tr} top={tr * 0.75} h={trunkH} c={BARK} rough={0.95} seg={10} />
      <C p={[0, 0.03, 0]} r={tr * 1.6} top={tr} h={0.06} c={shade(BARK, 0.9)} rough={1} seg={10} />
      {branches.map((b, i) => (
        <group key={`b${i}`} position={[0, trunkH * 0.97, 0]} rotation={[0, -b.a, 0]}>
          <mesh position={[(Math.sin(b.tilt) * b.len) / 2, (Math.cos(b.tilt) * b.len) / 2, 0]} rotation={[0, 0, -b.tilt]} castShadow>
            <cylinderGeometry args={[tr * 0.35, tr * 0.7, b.len, 8]} />
            <meshStandardMaterial color={shade(BARK, 1.05)} roughness={0.95} />
          </mesh>
        </group>
      ))}
      {clusters.map((cl, i) => <Blob key={i} p={cl.p} r={cl.r} sc={[1, flat, 1]} c={leaf(i)} v={seed + i} />)}
      {blooms.map((f, i) => <Blob key={`f${i}`} p={f.p} r={f.r} c={vary(flowers!, rand, 0.5)} v={seed + i + 3} rough={0.8} />)}
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
  lavamanos: basin, ducha: shower, banera: tub, espejo: mirror,
  porton: slidingGate, lavadero: washtub, lavadora: washer, matera: plant, arbol: tree, poste: streetLamp, banca: bench, carro: car, moto, piscina: pool,
  asoleadora: lounger, sombrilla: umbrella, pergola, bar, parrilla: grill, jardinera: planter,
  centroEntretenimiento: entertainment, consola: console_, cortina: curtain, tiraLed: ledStrip, cuadro: picture,
  repisa: collectiblesShelf, jacuzzi, toallero: towelRail, brasero: firePit, puf: pouf, jardinVertical: verticalGarden,
  vestier: dressing,
};

/** The model of one piece in its local frame (no position or rotation). */
export function FurnitureModel3D({ f }: { f: Furniture }) {
  const item = catalogItem(f.type);
  const c = f.color ?? item?.color ?? '#b08a63';
  const build = item ? BUILDERS[item.model] : null;
  return build ? build({ w: f.width, d: f.depth, h: f.height, c, item, seed: hashSeed(f.id), open: f.open }) : <B p={[0, f.height / 2, 0]} s={[f.width, f.height, f.depth]} c={c} />;
}

function SelectionBox({ f, color }: { f: Furniture; color: string }) {
  const { depth, height } = tiltedSize(f);
  const geometry = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(f.width + 0.04, height + 0.04, depth + 0.04)), [f.width, height, depth]);
  return (
    <lineSegments geometry={geometry} position={[0, height / 2, 0]}>
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
          <Tilted f={f}><FurnitureModel3D f={f} /></Tilted>
          {f.id === selectedId && <SelectionBox f={f} color={pal.selected} />}
        </group>
      ))}
    </group>
  );
}

/** Tips a piece over about its own width axis, turning round its centre and keeping its lowest point on its base. */
function Tilted({ f, children }: { f: Furniture; children: ReactNode }) {
  if (!f.tilt) return <>{children}</>;
  return (
    <group position={[0, tiltedSize(f).height / 2, 0]} rotation={[(f.tilt * Math.PI) / 180, 0, 0]}>
      <group position={[0, -f.height / 2, 0]}>{children}</group>
    </group>
  );
}
