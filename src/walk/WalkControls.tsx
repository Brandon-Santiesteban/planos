import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { useEditor } from '../store/editorStore';
import { isEditableTarget } from '../ui/keys';
import { blockingSegments, EYE_HEIGHT } from './physics';
import { look, stepWalker, walkStart, type Walker } from './walker';
import { useWalk } from './walkStore';

const KEYS: Record<string, [number, number]> = {
  KeyW: [1, 0], ArrowUp: [1, 0], KeyS: [-1, 0], ArrowDown: [-1, 0],
  KeyA: [0, -1], ArrowLeft: [0, -1], KeyD: [0, 1], ArrowRight: [0, 1],
};

/** First-person camera: click to capture the mouse, W A S D / arrows to move. State lives in refs, not React. */
export default function WalkControls() {
  const camera = useThree((s) => s.camera);
  const canvas = useThree((s) => s.gl.domElement);
  const project = useEditor((s) => s.project);
  const perFloor = useMemo(() => project.floors.map(blockingSegments), [project]);
  const walker = useRef<Walker | null>(null);
  const pressed = useRef(new Set<string>());

  if (!walker.current) {
    const { activeFloorId, selection } = useEditor.getState();
    walker.current = walkStart(useEditor.getState().project, activeFloorId, selection);
  }

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.code in KEYS || e.key === 'Shift') {
        pressed.current.add(e.key === 'Shift' ? 'Shift' : e.code);
        if (e.code.startsWith('Arrow')) e.preventDefault();
      }
    };
    const onUp = (e: KeyboardEvent) => pressed.current.delete(e.key === 'Shift' ? 'Shift' : e.code);
    const onBlur = () => pressed.current.clear();
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement === canvas && walker.current) walker.current = look(walker.current, e.movementX, e.movementY);
    };
    const onClick = () => {
      if (document.pointerLockElement !== canvas) void Promise.resolve(canvas.requestPointerLock?.()).catch(() => {});
    };
    const onLock = () => useWalk.getState().set({ looking: document.pointerLockElement === canvas });
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('pointerlockchange', onLock);
    canvas.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('pointerlockchange', onLock);
      canvas.removeEventListener('click', onClick);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      useWalk.getState().set({ looking: false });
    };
  }, [canvas]);

  useFrame((_, delta) => {
    let w = walker.current!;
    let forward = 0;
    let right = 0;
    for (const k of pressed.current) {
      const m = KEYS[k];
      if (m) {
        forward += m[0];
        right += m[1];
      }
    }
    // Long frames (a background tab) shouldn't throw you across the room.
    w = stepWalker(w, { forward, right, run: pressed.current.has('Shift') }, Math.min(delta, 0.1), project, perFloor);
    walker.current = w;
    camera.position.set(w.pos.x, w.feet + EYE_HEIGHT, w.pos.y);
    camera.rotation.set(w.pitch, w.yaw, 0, 'YXZ');
  });

  return null;
}
