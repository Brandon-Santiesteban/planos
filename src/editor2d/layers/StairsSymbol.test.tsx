// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { createEmptyProject } from '../../model/defaults';
import { addRoom, setRoomKind, setStairShape, setStairUp } from '../../model/ops';
import RoomsLayer from './RoomsLayer';

function draw(shape: 'recta' | 'u') {
  const p = createEmptyProject();
  const f = p.floors[0].id;
  const id = addRoom(p, f, [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 3 }, { x: 0, y: 3 }], 'Escalera')!;
  setRoomKind(p, f, id, 'stairs');
  setStairUp(p, f, id, 's');
  setStairShape(p, f, id, shape);
  return render(<svg><RoomsLayer floor={p.floors[0]} selection={null} pxPerMetre={60} /></svg>).container;
}

test('stairs are drawn with a line per step and an arrow going up', () => {
  const c = draw('recta');
  expect(c.querySelectorAll('.stair-step').length).toBe(14); // 15 risers for 2,6 m
  const arrow = c.querySelector('.stair-arrow')!;
  expect(arrow.getAttribute('points')!.split(' ')).toHaveLength(2);
  expect(c.querySelector('.stair-arrow-head')).not.toBeNull();
});

test('a U stairs arrow goes up one flight and back along the other', () => {
  const c = draw('u');
  expect(c.querySelector('.stair-arrow')!.getAttribute('points')!.split(' ')).toHaveLength(4);
  expect(c.querySelector('.stair-divider')).not.toBeNull();
});
