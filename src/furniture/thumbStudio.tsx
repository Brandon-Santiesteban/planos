// Photo studio for the catalog pictures (public/muebles/<id>.png): each piece drawn by its own 3D model, in colour,
// seen from the front and a little from above. Used only by scripts/miniaturas-muebles.mjs, never by the app.
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { furnitureFromCatalog } from '../model/furnitureOps';
import { CATALOG, type CatalogItem } from './catalog';
import { FurnitureModel3D } from './meshes';

function Shot({ item, onShot }: { item: CatalogItem; onShot: (url: string) => void }) {
  const { gl, camera, scene } = useThree();
  const frames = useRef(0);
  useLayoutEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    // Frame the whole piece: front-right three-quarter view, a little from above.
    const h = Math.max(item.height, 0.05);
    const size = Math.max(item.width, item.depth, h);
    const centre = new THREE.Vector3(0, h / 2, 0);
    const dir = new THREE.Vector3(0.55, 0.45, 1).normalize();
    const cam = camera as THREE.PerspectiveCamera;
    const dist = (size * 0.62) / Math.tan((cam.fov * Math.PI) / 360) + Math.max(item.depth, item.width) * 0.15;
    cam.position.copy(centre).addScaledVector(dir, dist);
    cam.lookAt(centre);
    cam.near = dist / 100;
    cam.far = dist * 10;
    cam.updateProjectionMatrix();
  }, [item, gl, camera, scene]);
  useFrame(() => {
    // A few frames so textures and environment are in.
    if (++frames.current === 4) onShot(gl.domElement.toDataURL('image/png'));
  });
  const f = { ...furnitureFromCatalog(item.id, { x: 0, y: 0 }, 0), id: 'miniatura', elevation: 0 };
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[2, 4, 3]} intensity={1.6} />
      <directionalLight position={[-3, 2, -1]} intensity={0.4} />
      <FurnitureModel3D f={f} />
    </>
  );
}

/** Pictures of the given catalog pieces (all of them by default) as PNG data URLs, by id. */
export async function renderThumbs(ids = CATALOG.map((i) => i.id), px = 256): Promise<Record<string, string>> {
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:0;top:0;width:${px}px;height:${px}px;z-index:99999`;
  document.body.appendChild(host);
  const root = createRoot(host);
  const out: Record<string, string> = {};
  try {
    for (const id of ids) {
      const item = CATALOG.find((i) => i.id === id);
      if (!item) continue;
      out[id] = await new Promise<string>((resolve) => {
        root.render(
          <Canvas key={id} dpr={1} gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true }} camera={{ fov: 30 }} style={{ width: px, height: px }}>
            <Shot item={item} onShot={resolve} />
          </Canvas>,
        );
      });
    }
  } finally {
    root.unmount();
    host.remove();
  }
  return out;
}
