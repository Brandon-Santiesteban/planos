import { createEmptyProject } from './defaults';
import { addRectRoom } from './ops';
import { drawingBounds, setSite, siteAround, siteFittingDrawing, siteOverflow } from './site';

function house() {
  const p = createEmptyProject();
  addRectRoom(p, p.floors[0].id, { x: 0, y: 0 }, 6, 10, 'Casa'); // walls 0,15: outer faces −0,075 … 6,225 / 10,225
  return p;
}

test('the drawing reaches the outer faces of the walls', () => {
  const b = drawingBounds(house())!;
  expect(b.minX).toBeCloseTo(-0.075);
  expect(b.maxX).toBeCloseTo(6.225);
  expect(b.maxY).toBeCloseTo(10.225);
  expect(drawingBounds(createEmptyProject())).toBeNull();
});

test('a lot is placed with its front on the front of the drawing, aligned left, centred or right', () => {
  const p = house();
  expect(siteAround(p, 7, 22)).toEqual({ x: -0.075, y: 10.225 - 22, width: 7, depth: 22 });
  expect(siteAround(p, 7, 22, 'derecha').x).toBeCloseTo(6.225 - 7);
  expect(siteAround(p, 7, 22, 'centro').x).toBeCloseTo((6.15 - 7) / 2);
});

test('fitting the drawing rounds out to 5 cm, and the overflow says where the drawing sticks out', () => {
  const p = house();
  expect(siteFittingDrawing(p)).toEqual({ x: -0.1, y: -0.1, width: 6.35, depth: 10.35 });
  setSite(p, { x: 0, y: 0, width: 6, depth: 12 });
  expect(siteOverflow(p)).toEqual({ izquierda: 0.075, derecha: 0.225, fondo: 0.075, frente: 0 });
  setSite(p, null);
  expect(p.site).toBeUndefined();
  expect(siteOverflow(p)).toBeNull();
});
