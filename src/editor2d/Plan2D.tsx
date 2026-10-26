import { useEffect, useReducer, useRef, useState } from 'react';
import type { Vec2 } from '../model/types';
import { useEditor } from '../store/editorStore';
import LengthInput from '../ui/LengthInput';
import BackgroundLayer from './layers/BackgroundLayer';
import DimensionsLayer from './layers/DimensionsLayer';
import GridLayer from './layers/GridLayer';
import OpeningsLayer from './layers/OpeningsLayer';
import RoomsLayer from './layers/RoomsLayer';
import WallsLayer from './layers/WallsLayer';
import PreviewLayer from './PreviewLayer';
import { getTool, type ToolContext } from './tools';
import { type Size, type View, screenToWorld, worldToScreen, zoomAt } from './viewport';

const DEFAULT_SIZE: Size = { w: 800, h: 600 };

export default function Plan2D() {
  const project = useEditor((s) => s.project);
  const activeFloorId = useEditor((s) => s.activeFloorId);
  const selection = useEditor((s) => s.selection);
  const toolName = useEditor((s) => s.tool);
  const floorIndex = Math.max(0, project.floors.findIndex((f) => f.id === activeFloorId));
  const floor = project.floors[floorIndex];
  const tool = getTool(toolName);

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<Size>(DEFAULT_SIZE);
  const [view, setView] = useState<View>({ centre: { x: 4, y: 3 }, pxPerMetre: 60 });
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const pan = useRef<{ last: Vec2 } | null>(null);
  const spaceDown = useRef(false);
  const mods = useRef({ altKey: false, shiftKey: false });
  const viewRef = useRef(view);
  viewRef.current = view;
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const ctx = (): ToolContext => ({ state: useEditor.getState(), view: viewRef.current, ...mods.current });

  // Reset the previous tool's in-progress state when switching tools or floors.
  useEffect(() => () => tool.reset(), [tool, activeFloorId]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width || 1, h: e.contentRect.height || 1 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Wheel zoom needs a non-passive listener to prevent page scroll.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.0015);
      setView((v) => zoomAt(v, { w: r.width || 1, h: r.height || 1 }, { x: e.clientX - r.left, y: e.clientY - r.top }, factor));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Keys go to the active tool first (capture phase) so typed lengths don't trigger shortcuts.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      mods.current = { altKey: e.altKey, shiftKey: e.shiftKey };
      if (e.code === 'Space') spaceDown.current = true;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.ctrlKey || e.metaKey) return;
      if (tool.onKey?.(e.key, ctx())) {
        e.preventDefault();
        e.stopImmediatePropagation();
        redraw();
      }
    };
    const up = (e: KeyboardEvent) => {
      mods.current = { altKey: e.altKey, shiftKey: e.shiftKey };
      if (e.code === 'Space') spaceDown.current = false;
    };
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up);
    };
  }, [tool]);

  const toWorld = (e: React.PointerEvent | React.MouseEvent): Vec2 => {
    const r = svgRef.current!.getBoundingClientRect();
    return screenToWorld(viewRef.current, sizeRef.current, { x: e.clientX - r.left, y: e.clientY - r.top });
  };
  const readMods = (e: React.PointerEvent | React.MouseEvent) => {
    mods.current = { altKey: e.altKey, shiftKey: e.shiftKey };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    readMods(e);
    if (e.button === 1 || e.button === 2 || (e.button === 0 && spaceDown.current)) {
      pan.current = { last: { x: e.clientX, y: e.clientY } };
      svgRef.current?.setPointerCapture?.(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    svgRef.current?.setPointerCapture?.(e.pointerId);
    tool.onPointerDown?.(toWorld(e), ctx());
    redraw();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    readMods(e);
    if (pan.current) {
      const dx = e.clientX - pan.current.last.x;
      const dy = e.clientY - pan.current.last.y;
      pan.current.last = { x: e.clientX, y: e.clientY };
      setView((v) => ({ ...v, centre: { x: v.centre.x - dx / v.pxPerMetre, y: v.centre.y - dy / v.pxPerMetre } }));
      return;
    }
    tool.onPointerMove?.(toWorld(e), ctx());
    redraw();
  };
  const onPointerUp = (e: React.PointerEvent) => {
    readMods(e);
    if (pan.current) {
      pan.current = null;
      return;
    }
    tool.onPointerUp?.(toWorld(e), ctx());
    redraw();
  };
  const onDoubleClick = (e: React.MouseEvent) => {
    tool.onDoubleClick?.(toWorld(e), ctx());
    redraw();
  };

  const k = view.pxPerMetre;
  const transform = `translate(${size.w / 2} ${size.h / 2}) scale(${k}) translate(${-view.centre.x} ${-view.centre.y})`;
  const preview = tool.preview();
  const typing = preview?.kind === 'wall' && preview.typed !== '' ? preview : null;
  const typingAt = typing ? worldToScreen(view, size, typing.b) : null;
  const below = floorIndex > 0 ? project.floors[floorIndex - 1] : null;

  return (
    <div ref={wrapRef} className={`plan2d-wrap tool-${toolName}`}>
      <svg
        ref={svgRef}
        className="plan2d"
        data-testid="plan2d"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        <g transform={transform}>
          <BackgroundLayer bg={floor.background} />
          <GridLayer view={view} size={size} />
          {below && <WallsLayer floor={below} ghost />}
          <RoomsLayer floor={floor} selection={selection} pxPerMetre={k} />
          <WallsLayer floor={floor} selection={selection} />
          <OpeningsLayer floor={floor} selection={selection} />
          <DimensionsLayer floor={floor} pxPerMetre={k} />
          <PreviewLayer preview={preview} pxPerMetre={k} />
        </g>
      </svg>
      {typing && typingAt && <LengthInput text={typing.typed} valid={typing.typedValid} x={typingAt.x} y={typingAt.y} label={toolName === 'calibrate' ? 'Medida real' : 'Longitud'} />}
    </div>
  );
}
