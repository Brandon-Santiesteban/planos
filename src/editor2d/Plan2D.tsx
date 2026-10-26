import { useEffect, useRef, useState } from 'react';
import type { Vec2 } from '../model/types';
import { useEditor } from '../store/editorStore';
import BackgroundLayer from './layers/BackgroundLayer';
import DimensionsLayer from './layers/DimensionsLayer';
import GridLayer from './layers/GridLayer';
import OpeningsLayer from './layers/OpeningsLayer';
import RoomsLayer from './layers/RoomsLayer';
import WallsLayer from './layers/WallsLayer';
import { type Size, type View, zoomAt } from './viewport';

const DEFAULT_SIZE: Size = { w: 800, h: 600 };

export default function Plan2D() {
  const project = useEditor((s) => s.project);
  const activeFloorId = useEditor((s) => s.activeFloorId);
  const selection = useEditor((s) => s.selection);
  const floor = project.floors.find((f) => f.id === activeFloorId) ?? project.floors[0];

  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<Size>(DEFAULT_SIZE);
  const [view, setView] = useState<View>({ centre: { x: 4, y: 3 }, pxPerMetre: 60 });
  const pan = useRef<{ last: Vec2 } | null>(null);
  const spaceDown = useRef(false);

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

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'Space') spaceDown.current = true; };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') spaceDown.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || e.button === 2 || (e.button === 0 && spaceDown.current)) {
      pan.current = { last: { x: e.clientX, y: e.clientY } };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pan.current) return;
    const dx = e.clientX - pan.current.last.x;
    const dy = e.clientY - pan.current.last.y;
    pan.current.last = { x: e.clientX, y: e.clientY };
    setView((v) => ({ ...v, centre: { x: v.centre.x - dx / v.pxPerMetre, y: v.centre.y - dy / v.pxPerMetre } }));
  };
  const onPointerUp = () => { pan.current = null; };

  const k = view.pxPerMetre;
  const transform = `translate(${size.w / 2} ${size.h / 2}) scale(${k}) translate(${-view.centre.x} ${-view.centre.y})`;

  return (
    <svg
      ref={svgRef}
      className="plan2d"
      data-testid="plan2d"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <g transform={transform}>
        <BackgroundLayer bg={floor.background} />
        <GridLayer view={view} size={size} />
        <RoomsLayer floor={floor} selection={selection} pxPerMetre={k} />
        <WallsLayer floor={floor} selection={selection} />
        <OpeningsLayer floor={floor} selection={selection} />
        <DimensionsLayer floor={floor} pxPerMetre={k} />
      </g>
    </svg>
  );
}
