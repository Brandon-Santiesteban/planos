import { useEffect, useMemo } from 'react';
import { BackSide, BufferAttribute, BufferGeometry, CanvasTexture, Color, RepeatWrapping, ShaderMaterial, SRGBColorSpace } from 'three';
import type { OutdoorLight, RoomLight } from './roomLights';
import type { TimeOfDay } from './sceneOptions';
import { sunPosition } from './sun';

const WARM = '#FFB46B'; // ~2700 K, warm white bulb

/** Fill light and sun/moon for each time of day. Night keeps enough blue fill to see the green grass. */
const LOOK: Record<TimeOfDay, {
  hemi: [string, string, number]; sun: string; sunIntensity: number; room: number; outdoor: number;
}> = {
  manana: { hemi: ['#ffffff', '#9fae8a', 0.85], sun: '#ffffff', sunIntensity: 1.5, room: 1.2, outdoor: 0.4 },
  tarde: { hemi: ['#ffe0bd', '#5d5a3c', 0.55], sun: '#ffb070', sunIntensity: 1.1, room: 4, outdoor: 3 },
  noche: { hemi: ['#5a6f9a', '#3b5a2a', 1.0], sun: '#9fb4e0', sunIntensity: 0.45, room: 9, outdoor: 7 },
};

/** Sky dome colours (zenith, horizon) per time of day: a calm blue morning, a sunset, a deep night. */
const DOME: Record<TimeOfDay, [string, string]> = {
  manana: ['#5b93c7', '#d6e6f2'],
  tarde: ['#4a6290', '#e8b48e'],
  noche: ['#03060f', '#1a2846'],
};
export const horizonColor = (time: TimeOfDay) => DOME[time][1];

const SKY_RADIUS = 240;

/** A gradient sky around the scene (instead of a flat background), with stars at night. */
export function SkyDome({ time, cx, cz }: { time: TimeOfDay; cx: number; cz: number }) {
  const material = useMemo(() => new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: { top: { value: new Color() }, bottom: { value: new Color() } },
    vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vDir; void main() { float h = clamp(vDir.y, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.6)), 1.0); }',
  }), []);
  useEffect(() => () => material.dispose(), [material]);
  material.uniforms.top.value.set(DOME[time][0]);
  material.uniforms.bottom.value.set(DOME[time][1]);
  const stars = useMemo(() => {
    const n = 900;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      // Upper hemisphere, a little above the horizon.
      const a = Math.random() * Math.PI * 2;
      const y = 0.08 + Math.random() * 0.92;
      const r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(a) * r * (SKY_RADIUS - 5), y * (SKY_RADIUS - 5), Math.sin(a) * r * (SKY_RADIUS - 5)], i * 3);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    return g;
  }, []);
  useEffect(() => () => stars.dispose(), [stars]);
  return (
    <group position={[cx, 0, cz]}>
      <mesh material={material} renderOrder={-1}>
        <sphereGeometry args={[SKY_RADIUS, 32, 16]} />
      </mesh>
      {time === 'noche' && (
        <points geometry={stars}>
          <pointsMaterial color="#f4f1e6" size={0.9} sizeAttenuation depthWrite={false} />
        </points>
      )}
    </group>
  );
}

/** Procedural grass, soft and slightly desaturated so it doesn't steal attention from the house. */
function makeGrassTexture(): CanvasTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#6E8A58';
  g.fillRect(0, 0, size, size);
  const tones = ['#66824F', '#768F60', '#627C4C', '#7A9364'];
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = tones[i % tones.length];
    g.fillRect(Math.random() * size, Math.random() * size, 1.5, 3 + Math.random() * 3);
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(100, 100);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function Ground({ grass, color, cx, cz }: { grass: boolean; color: string; cx: number; cz: number }) {
  const texture = useMemo(() => (grass ? makeGrassTexture() : null), [grass]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.03, cz]} receiveShadow>
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial key={grass ? 'cesped' : 'liso'} color={grass ? '#ffffff' : color} map={texture} roughness={1} />
    </mesh>
  );
}

export function SkyLights({ time, north, cx, cz }: { time: TimeOfDay; north: number; cx: number; cz: number }) {
  const look = LOOK[time];
  const [sx, sy, sz] = sunPosition(north, time, 20);
  return (
    <>
      <hemisphereLight args={look.hemi} />
      <directionalLight
        position={[cx + sx, sy, cz + sz]}
        target-position={[cx, 0, cz]}
        color={look.sun}
        intensity={look.sunIntensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
    </>
  );
}

/** Warm ceiling bulbs: a point light plus a small glowing fixture in every room. */
export function RoomLights({ lights, time }: { lights: RoomLight[]; time: TimeOfDay }) {
  const k = LOOK[time].room;
  return (
    <>
      {lights.map((l) => (
        <group key={l.roomId} position={[l.x, l.y, l.z]}>
          <pointLight color={WARM} intensity={k} distance={7} decay={2} />
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 0.03, 24]} />
            <meshStandardMaterial color={WARM} emissive={WARM} emissiveIntensity={k / 3} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** Porch, balcony and garden lights: a soffit light over each, short glowing posts on the ground ones. */
export function OutdoorLights({ lights, time }: { lights: OutdoorLight[]; time: TimeOfDay }) {
  const k = LOOK[time].outdoor;
  return (
    <>
      {lights.map((l) =>
        l.kind === 'soffit' ? (
          <group key={l.key} position={[l.x, l.y, l.z]}>
            <pointLight color={WARM} intensity={k} distance={5} decay={2} />
            <mesh>
              <boxGeometry args={[0.18, 0.04, 0.18]} />
              <meshStandardMaterial color={WARM} emissive={WARM} emissiveIntensity={k / 2.5} />
            </mesh>
          </group>
        ) : (
          <group key={l.key} position={[l.x, 0, l.z]}>
            <mesh position={[0, l.y / 2, 0]} castShadow>
              <cylinderGeometry args={[0.04, 0.05, l.y, 12]} />
              <meshStandardMaterial color="#2b2f36" metalness={0.5} roughness={0.5} />
            </mesh>
            <mesh position={[0, l.y + 0.04, 0]}>
              <cylinderGeometry args={[0.06, 0.06, 0.08, 16]} />
              <meshStandardMaterial color={WARM} emissive={WARM} emissiveIntensity={k / 2} />
            </mesh>
            <pointLight position={[0, l.y + 0.05, 0]} color={WARM} intensity={k / 3} distance={2.5} decay={2} />
          </group>
        ),
      )}
    </>
  );
}
