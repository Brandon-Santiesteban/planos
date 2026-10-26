import { type Camera, type Scene, SRGBColorSpace, Vector2, type WebGLRenderer, WebGLRenderTarget } from 'three';
import { scaledSize } from './resolution';

/** Largest side the GPU can render to and read back. */
export function maxRenderSide(gl: WebGLRenderer): number {
  const ctx = gl.getContext();
  const dims = ctx.getParameter(ctx.MAX_VIEWPORT_DIMS) as Int32Array;
  return Math.min(gl.capabilities.maxTextureSize, ctx.getParameter(ctx.MAX_RENDERBUFFER_SIZE) as number, dims[0], dims[1], 8192);
}

/** Copies RGBA rows (bottom-up, as WebGL reads them) into a canvas and encodes a PNG. */
async function pixelsToPng(pixels: Uint8Array, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(width, height);
  const row = width * 4;
  for (let y = 0; y < height; y++) image.data.set(pixels.subarray((height - 1 - y) * row, (height - y) * row), y * row);
  ctx.putImageData(image, 0, 0);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('El navegador no pudo crear el PNG'))), 'image/png'),
  );
}

/**
 * Renders the current view offscreen at `factor`× the canvas resolution and returns a PNG.
 * The on-screen canvas is never resized.
 *
 * The target is flagged like an XR target so three applies tone mapping and the sRGB output
 * conversion exactly as it does for the screen (normal render targets stay linear and untoned).
 */
export async function capturePhoto(gl: WebGLRenderer, scene: Scene, camera: Camera, factor = 2): Promise<{ blob: Blob; width: number; height: number }> {
  const buffer = gl.getDrawingBufferSize(new Vector2());
  const { width, height } = scaledSize(buffer.x, buffer.y, factor, maxRenderSide(gl));
  const target = new WebGLRenderTarget(width, height, { samples: 4, colorSpace: SRGBColorSpace });
  (target as unknown as { isXRRenderTarget: boolean }).isXRRenderTarget = true;
  // Plain 8-bit storage for both the multisampled buffer and the resolved texture (the shader already
  // encodes sRGB); otherwise the MSAA resolve fails on a format mismatch.
  target.texture.internalFormat = 'RGBA8';
  const previous = gl.getRenderTarget();
  const pixels = new Uint8Array(width * height * 4);
  try {
    gl.setRenderTarget(target);
    gl.clear();
    gl.render(scene, camera);
    gl.readRenderTargetPixels(target, 0, 0, width, height, pixels);
  } finally {
    gl.setRenderTarget(previous);
    target.dispose();
  }
  return { blob: await pixelsToPng(pixels, width, height), width, height };
}

/** Saves a blob with the browser's download. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
