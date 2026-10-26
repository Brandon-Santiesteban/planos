import { GradientEquirectTexture, WebGLPathTracer } from 'three-gpu-pathtracer';
import { type Camera, type Color, type HemisphereLight, PerspectiveCamera, WebGLRenderer } from 'three';
import { RENDER_PRESETS, type RenderPreset } from './presets';
import type { RenderContext } from './renderStore';
import { type HemiLight, skyGradient } from './sky';

/**
 * three's hemisphere light lights a surface facing up with (sky × intensity) × albedo / π;
 * a path-traced environment of radiance L gives L × albedo. So L = sky × intensity / π.
 */
const HEMI_TO_RADIANCE = 1 / Math.PI;

function hemisphereLights(ctx: RenderContext): HemiLight[] {
  const out: HemiLight[] = [];
  ctx.scene.traverseVisible((o) => {
    const h = o as HemisphereLight;
    if (h.isHemisphereLight) out.push({ sky: h.color.toArray() as HemiLight['sky'], ground: h.groundColor.toArray() as HemiLight['ground'], intensity: h.intensity });
  });
  return out;
}

/**
 * A photorealistic still of the current view: three-gpu-pathtracer on its own canvas and WebGL
 * context, so the live 3D view keeps working and is never resized.
 */
export class RealisticRender {
  readonly renderer: WebGLRenderer;
  readonly target: number;
  private tracer: WebGLPathTracer;
  private camera: PerspectiveCamera;
  private sky: GradientEquirectTexture;
  private ready = false;

  constructor(canvas: HTMLCanvasElement, private ctx: RenderContext, width: number, height: number, preset: RenderPreset) {
    const p = RENDER_PRESETS[preset];
    this.target = p.samples;
    this.renderer = new WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.renderer.toneMapping = ctx.gl.toneMapping;
    this.renderer.toneMappingExposure = ctx.gl.toneMappingExposure;
    this.renderer.outputColorSpace = ctx.gl.outputColorSpace;
    this.renderer.shadowMap.enabled = true;

    this.camera = cloneCamera(ctx.camera, width / height);
    const bg = ctx.scene.background as Color | null;
    this.backdrop = bg?.isColor ? `#${bg.getHexString()}` : '#ffffff';
    canvas.style.backgroundColor = this.backdrop;

    this.tracer = new WebGLPathTracer(this.renderer);
    this.tracer.bounces = p.bounces;
    this.tracer.transmissiveBounces = 6;
    this.tracer.filterGlossyFactor = 0.5; // fewer fireflies from the small bright bulbs
    this.tracer.tiles.set(2, 2); // a quarter of the image per frame keeps the browser responsive
    this.tracer.renderDelay = 0;
    this.tracer.minSamples = 1;
    this.tracer.fadeDuration = 0;

    const g = skyGradient(hemisphereLights(ctx), HEMI_TO_RADIANCE);
    this.sky = new GradientEquirectTexture(64);
    this.sky.exponent = 1;
    this.sky.topColor.setRGB(...g.top);
    this.sky.bottomColor.setRGB(...g.bottom);
    this.sky.update();
  }

  /**
   * Sky colour behind the house. The path tracer would tone-map a colour background (greyer than
   * on screen), so the sky is left transparent and painted with this colour, like the live view.
   */
  readonly backdrop: string;

  /** Builds the BVH and uploads materials and lights. The live scene is only borrowed. */
  async prepare(): Promise<void> {
    const { scene } = this.ctx;
    // Let the browser paint the progress card first: building the BVH blocks the main thread
    // (the async variant needs a BVH web worker; a house is small enough to build it inline).
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    const previous = { environment: scene.environment, intensity: scene.environmentIntensity, background: scene.background };
    scene.environment = this.sky;
    scene.environmentIntensity = 1;
    scene.background = null;
    try {
      this.tracer.setScene(scene, this.camera);
    } finally {
      scene.environment = previous.environment;
      scene.environmentIntensity = previous.intensity;
      scene.background = previous.background;
    }
    this.ready = true;
  }

  get samples(): number {
    return this.tracer.samples;
  }

  get compiling(): boolean {
    // Present at runtime, missing from the package's typings.
    return (this.tracer as unknown as { isCompiling: boolean }).isCompiling;
  }

  /** Renders one tile of the next sample. */
  step() {
    if (this.ready) this.tracer.renderSample();
  }

  /** The current image over the sky colour, as a PNG. */
  toBlob(): Promise<Blob> {
    const src = this.renderer.domElement;
    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    const g = out.getContext('2d')!;
    g.fillStyle = this.backdrop;
    g.fillRect(0, 0, out.width, out.height);
    g.drawImage(src, 0, 0);
    return new Promise((resolve, reject) =>
      out.toBlob((b) => (b ? resolve(b) : reject(new Error('El navegador no pudo crear el PNG'))), 'image/png'),
    );
  }

  dispose() {
    this.ready = false;
    this.tracer.dispose();
    this.sky.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

function cloneCamera(source: Camera, aspect: number): PerspectiveCamera {
  const src = source as PerspectiveCamera;
  const cam = src.isPerspectiveCamera ? src.clone() : new PerspectiveCamera(60, aspect, 0.05, 500);
  if (!src.isPerspectiveCamera) {
    cam.position.copy(source.position);
    cam.quaternion.copy(source.quaternion);
  }
  cam.aspect = aspect;
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  return cam;
}

/** Path tracing needs WebGL 2 with float render targets. */
export function canPathTrace(gl: WebGLRenderer): boolean {
  return gl.extensions.has('EXT_color_buffer_float');
}
