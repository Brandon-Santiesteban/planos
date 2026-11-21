// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { createEmptyProject } from '../../model/defaults';
import { addOpening, addRoom, addWall } from '../../model/ops';
import { fittedFont } from '../layers/RoomsLayer';
import PlanPhotoSvg from './PlanPhotoSvg';
import { CAPTION, DEFAULT_PHOTO_OPTIONS, DRAW_LONG, MARGIN, MIN_WIDTH, photoBounds, photoFileName, photoLayout, scaleBarLength, type PhotoOptions } from './planPhoto';

const opts: PhotoOptions = { ...DEFAULT_PHOTO_OPTIONS, area: false };

function house() {
  const p = createEmptyProject();
  p.name = 'Casa: prueba';
  const f = p.floors[0].id;
  const w = addWall(p, f, { x: 0, y: 0 }, { x: 10, y: 0 })!;
  addWall(p, f, { x: 10, y: 0 }, { x: 10, y: 4 });
  addOpening(p, f, w, 'door', 2);
  addRoom(p, f, [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 0, y: 4 }], 'Sala');
  return p;
}

test('the picture is framed to the drawing, with the lot only when asked', () => {
  const p = house();
  p.site = { x: -5, y: -5, width: 20, depth: 30 } as typeof p.site;
  const b = photoBounds(p, 0, opts)!;
  expect(b.minX).toBe(-5);
  expect(b.maxY).toBe(25);
  const noSite = photoBounds(p, 0, { ...opts, site: false })!;
  expect(noSite.minX).toBeCloseTo(-0.1, 1);
  expect(noSite.maxX).toBeCloseTo(10.1, 1);
  expect(photoBounds(createEmptyProject(), 0, opts)).toBeNull();
});

test('the long side fills the drawing area and the caption fits below', () => {
  const l = photoLayout({ minX: 0, minY: 0, maxX: 10, maxY: 4 });
  expect(l.width).toBe(DRAW_LONG);
  expect(l.k).toBeCloseTo((DRAW_LONG - 2 * MARGIN) / 10);
  expect(l.height).toBe(Math.round(4 * l.k + 2 * MARGIN + CAPTION));
  // a long thin house still leaves room for the caption
  expect(photoLayout({ minX: 0, minY: 0, maxX: 2, maxY: 30 }).width).toBe(MIN_WIDTH);
});

test('scale bar lengths are round numbers', () => {
  expect(scaleBarLength(40)).toBe(2);
  expect(scaleBarLength(100)).toBe(1);
  expect(scaleBarLength(5)).toBe(20);
});

test('file names drop characters files cannot have', () => {
  const p = house();
  expect(photoFileName(p, p.floors[0])).toBe(`Casa prueba - ${p.floors[0].name}.png`);
});

test('labels shrink to their room; narrow outdoor strips lose theirs', () => {
  const box = (w: number) => [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: 5 }, { x: 0, y: 5 }];
  expect(fittedFont(box(5), 'room', ['Sala'], 0.3)).toBe(0.3);
  expect(fittedFont(box(1.5), 'room', ['Habitación principal'], 0.3)).toBeLessThan(0.3);
  expect(fittedFont(box(0.6), 'exterior', ['Separación izquierda'], 0.3)).toBeNull();
  expect(fittedFont(box(0.6), 'room', ['Separación izquierda'], 0.3)).toBeCloseTo(0.18);
});

test('the photo has no selection, follows the toggles and carries a caption', () => {
  const p = house();
  const b = photoBounds(p, 0, opts)!;
  const { container, rerender } = render(<PlanPhotoSvg project={p} floorIndex={0} bounds={b} opts={opts} />);
  expect(container.querySelector('.selected')).toBeNull();
  expect(container.querySelectorAll('.dimension').length).toBe(2);
  expect(container.querySelector('.room-name')!.textContent).toBe('Sala');
  expect(container.querySelector('.door-leaf')).not.toBeNull();
  expect(container.textContent).toContain(`Casa: prueba · ${p.floors[0].name}`);
  expect(container.querySelector('.brujula')).not.toBeNull();
  rerender(<PlanPhotoSvg project={p} floorIndex={0} bounds={b} opts={{ ...opts, dimensions: false, names: false, grid: true }} />);
  expect(container.querySelector('.dimension')).toBeNull();
  expect(container.querySelector('.room-name')).toBeNull();
  expect(container.querySelector('.grid-major')).not.toBeNull();
});
