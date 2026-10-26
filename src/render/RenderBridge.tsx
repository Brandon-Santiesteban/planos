import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { useRender } from './renderStore';

/** Mounted inside <Canvas>: shares the renderer, scene and camera with the photo and render buttons. */
export default function RenderBridge() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    useRender.getState().setCtx({ gl, scene, camera });
    return () => useRender.getState().setCtx(null);
  }, [gl, scene, camera]);
  return null;
}
