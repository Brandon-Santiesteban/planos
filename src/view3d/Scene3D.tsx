import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { floorElevation } from '../model/ops';
import type { Project } from '../model/types';
import { useEditor } from '../store/editorStore';
import FloorMeshes from './FloorMeshes';
import { usePalette } from './palette';

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

  // Framing is computed once per loaded project so editing doesn't move the camera.
  const loadCount = useEditor((s) => s.loadCount);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const frame = useMemo(() => bounds(project), [loadCount]);
  const target: [number, number, number] = [frame.cx, floorElevation(project, project.floors[activeIndex].id), frame.cy];

  return (
    <div className="scene3d" data-testid="scene3d">
      <Canvas shadows camera={{ fov: 60, near: 0.05, far: 500, position: [frame.cx + frame.size, frame.size, frame.cy + frame.size * 1.2] }}>
        <color attach="background" args={[pal.sky]} />
        <hemisphereLight args={['#ffffff', '#b9a98f', 0.9]} />
        <directionalLight
          position={[frame.cx + 8, 15, frame.cy + 6]}
          intensity={1.6}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[frame.cx, -0.03, frame.cy]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color={pal.floor} />
        </mesh>
        <gridHelper key={pal.line} args={[60, 60, pal.line, pal.line]} position={[frame.cx, -0.025, frame.cy]} />
        {visible.map((f) => (
          <FloorMeshes key={f.id} floor={f} elevation={floorElevation(project, f.id)} selectedId={selection?.id ?? null} />
        ))}
        <OrbitControls makeDefault target={target} maxPolarAngle={Math.PI / 2 - 0.02} enableDamping />
        <CameraRig frame={frame} />
      </Canvas>
      <label className="scene-toggle">
        <input type="checkbox" checked={showUpperFloors} onChange={(e) => useEditor.getState().setShowUpperFloors(e.target.checked)} />
        Mostrar plantas superiores
      </label>
    </div>
  );
}
