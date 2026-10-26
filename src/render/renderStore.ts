import type { Camera, Scene, WebGLRenderer } from 'three';
import { create } from 'zustand';
import type { RenderPreset } from './presets';

/** What the overlay buttons need from inside the <Canvas>: published by <RenderBridge>. */
export interface RenderContext {
  gl: WebGLRenderer;
  scene: Scene;
  camera: Camera;
}

interface RenderState {
  ctx: RenderContext | null;
  open: boolean;
  preset: RenderPreset;
  setCtx(ctx: RenderContext | null): void;
  openWindow(): void;
  closeWindow(): void;
  setPreset(p: RenderPreset): void;
}

export const useRender = create<RenderState>()((set) => ({
  ctx: null,
  open: false,
  preset: 'bueno',
  setCtx: (ctx) => set({ ctx }),
  openWindow: () => set({ open: true }),
  closeWindow: () => set({ open: false }),
  setPreset: (preset) => set({ preset }),
}));
