import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { MOUSE } from 'three';
import { floorElevation } from '../model/ops';
import type { Project } from '../model/types';
import { useEditor } from '../store/editorStore';
import FloorMeshes from './FloorMeshes';
import { usePalette } from './palette';
import { outdoorLights, roomLights } from './roomLights';
import { type TimeOfDay, useSceneOptions } from './sceneOptions';
import SegmentedSwitch from '../ui/SegmentedSwitch';
import { Ground, OutdoorLights, RoomLights, SkyLights, skyColor } from './Surroundings';

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

export default function Scene3D() {
  const pal = usePalette();
  const project = useEditor((s) => s.project);
  const activeFloorId = useEditor((s) => s.activeFloorId);
  const selection = useEditor((s) => s.selection);
  const showUpperFloors = useEditor((s) => s.showUpperFloors);
  const activeIndex = Math.max(0, project.floors.findIndex((f) => f.id === activeFloorId));
  const visible = project.floors.filter((_, i) => i <= activeIndex || showUpperFloors);
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
        {/* Left: rotate · right: pan · wheel: zoom. Middle-button dragging (dolly) is off: the user found it confusing. */}
        <OrbitControls
          makeDefault
          target={target}
          maxPolarAngle={Math.PI / 2 - 0.02}
          enableDamping
          mouseButtons={{ LEFT: MOUSE.ROTATE, MIDDLE: -1 as MOUSE, RIGHT: MOUSE.PAN }}
        />
        <CameraRig frame={frame} />
      </Canvas>
      <div className="scene-toggle">
        <label>
          <input type="checkbox" checked={showUpperFloors} onChange={(e) => useEditor.getState().setShowUpperFloors(e.target.checked)} />
          Plantas superiores
        </label>
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
      </div>
    </div>
  );
}
