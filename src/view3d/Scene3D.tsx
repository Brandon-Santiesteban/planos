import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { type RefObject, useEffect, useMemo, useRef } from 'react';
import { MOUSE, Vector3 } from 'three';
import Compass from '../editor2d/Compass';
import { floorElevation } from '../model/ops';
import type { Project } from '../model/types';
import { useEditor } from '../store/editorStore';
import FloorMeshes from './FloorMeshes';
import FurnitureMeshes from '../furniture/meshes';
import { usePalette } from './palette';
import { outdoorLights, roomLights } from './roomLights';
import { type TimeOfDay, useSceneOptions } from './sceneOptions';
import SegmentedSwitch from '../ui/SegmentedSwitch';
import WalkControls from '../walk/WalkControls';
import { WalkButton, WalkHint } from '../walk/WalkOverlay';
import { useWalk } from '../walk/walkStore';
import { Ground, OutdoorLights, RoomLights, SkyLights, skyColor } from './Surroundings';
import RenderBridge from '../render/RenderBridge';
import RenderButtons from '../render/RenderButtons';

function bounds(p: Project) {
  const pts = p.floors.flatMap((f) => [...f.walls.flatMap((w) => [w.a, w.b]), ...f.rooms.flatMap((r) => r.points)]);
  if (!pts.length) return { cx: 4, cy: 3, size: 10 };
  const xs = pts.map((q) => q.x);
  const ys = pts.map((q) => q.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, size: Math.max(maxX - minX, maxY - minY, 6) };
}

type Frame = { cx: number; cy: number; size: number };

/** Moves the camera to frame the house whenever another project is opened. */
function CameraRig({ frame }: { frame: Frame }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: { set(x: number, y: number, z: number): void }; update(): void } | null;
  useEffect(() => {
    camera.position.set(frame.cx + frame.size * 1.3, frame.size * 1.2, frame.cy + frame.size * 1.6);
    controls?.target.set(frame.cx, 0, frame.cy);
    controls?.update();
  }, [frame, camera, controls]);
  return null;
}

/**
 * Turns the 3D compass needle so it points to geographic north as seen from the camera: the angle, clockwise from
 * the top of the screen, of the north direction on the ground.
 */
function CompassTracker({ north, needle }: { north: number; needle: RefObject<SVGGElement | null> }) {
  const v = useMemo(() => new Vector3(), []);
  useFrame(({ camera }) => {
    if (!needle.current) return;
    // Screen "up" laid on the ground; when the camera looks level, the forward direction instead.
    v.set(0, 1, 0).applyQuaternion(camera.quaternion);
    let fx = v.x;
    let fz = v.z;
    if (Math.hypot(fx, fz) < 0.2) {
      camera.getWorldDirection(v);
      fx = v.x;
      fz = v.z;
    }
    // North in plan/world terms: the top of the plan (−z) turned clockwise by `north` degrees.
    const t = (north * Math.PI) / 180;
    const nx = Math.sin(t);
    const nz = -Math.cos(t);
    const deg = (Math.atan2(nx * -fz + nz * fx, nx * fx + nz * fz) * 180) / Math.PI;
    needle.current.setAttribute('transform', `rotate(${deg.toFixed(1)})`);
  });
  return null;
}

export default function Scene3D() {
  const pal = usePalette();
  const project = useEditor((s) => s.project);
  const activeFloorId = useEditor((s) => s.activeFloorId);
  const selection = useEditor((s) => s.selection);
  const showUpperFloors = useEditor((s) => s.showUpperFloors);
  const walking = useWalk((s) => s.walking);
  // Leaving the 3D view ends the walk.
  useEffect(() => () => useWalk.getState().set({ walking: false }), []);
  const activeIndex = Math.max(0, project.floors.findIndex((f) => f.id === activeFloorId));
  const visible = project.floors.filter((_, i) => i <= activeIndex || showUpperFloors || walking);
  const { grass, time } = useSceneOptions();
  const visibleIds = visible.map((f) => f.id).join();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lights = useMemo(() => roomLights(project, visible.map((f) => f.id)), [project, visibleIds]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const outside = useMemo(() => outdoorLights(project, visible.map((f) => f.id)), [project, visibleIds]);

  // Framing is computed once per loaded project so editing doesn't move the camera.
  const loadCount = useEditor((s) => s.loadCount);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const frame = useMemo(() => bounds(project), [loadCount]);
  const target: [number, number, number] = [frame.cx, floorElevation(project, project.floors[activeIndex].id), frame.cy];
  const needle = useRef<SVGGElement>(null);

  return (
    <div className="scene3d" data-testid="scene3d">
      <Canvas shadows camera={{ fov: 60, near: 0.05, far: 500, position: [frame.cx + frame.size, frame.size, frame.cy + frame.size * 1.2] }}>
        <color attach="background" args={[skyColor(time, pal.sky)]} />
        <SkyLights time={time} north={project.north} cx={frame.cx} cz={frame.cy} />
        <Ground grass={grass} color={pal.floor} cx={frame.cx} cz={frame.cy} />
        {!grass && <gridHelper key={pal.line} args={[60, 60, pal.line, pal.line]} position={[frame.cx, -0.025, frame.cy]} />}
        <RoomLights lights={lights} time={time} />
        <OutdoorLights lights={outside} time={time} />
        {visible.map((f) => (
          <FloorMeshes key={f.id} floor={f} elevation={floorElevation(project, f.id)} selectedId={selection?.id ?? null} />
        ))}
        {visible.map((f) => <FurnitureMeshes key={`m${f.id}`} floor={f} elevation={floorElevation(project, f.id)} selectedId={selection?.id ?? null} />)}
        {walking ? <WalkControls /> : (
          <>
            {/* Left: rotate · right: pan · wheel: zoom. Middle-button dragging (dolly) is off: the user found it confusing. */}
            <OrbitControls
              makeDefault
              target={target}
              maxPolarAngle={Math.PI / 2 - 0.02}
              enableDamping
              mouseButtons={{ LEFT: MOUSE.ROTATE, MIDDLE: -1 as MOUSE, RIGHT: MOUSE.PAN }}
            />
            <CameraRig frame={frame} />
          </>
        )}
        <RenderBridge />
        <CompassTracker north={project.north} needle={needle} />
      </Canvas>
      <svg className="brujula-3d" width={76} height={80} aria-hidden="true">
        <Compass north={project.north} x={38} y={44} needleRef={needle} />
      </svg>
      <WalkHint />
      <div className="scene-toggle">
        {!walking && (
          <label>
            <input type="checkbox" checked={showUpperFloors} onChange={(e) => useEditor.getState().setShowUpperFloors(e.target.checked)} />
            Plantas superiores
          </label>
        )}
        <label>
          <input type="checkbox" checked={grass} onChange={(e) => useSceneOptions.getState().set({ grass: e.target.checked })} />
          Césped
        </label>
        <SegmentedSwitch<TimeOfDay>
          label="Hora del día"
          value={time}
          options={[{ value: 'manana', label: 'Mañana' }, { value: 'tarde', label: 'Tarde' }, { value: 'noche', label: 'Noche' }]}
          onChange={(t) => useSceneOptions.getState().set({ time: t })}
        />
        <WalkButton />
        <RenderButtons />
      </div>
    </div>
  );
}
