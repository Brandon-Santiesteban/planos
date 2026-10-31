import type { Room, Wall } from '../model/types';
import { railingEdges } from './railingEdges';

const garden: Room = {
  id: 'g', name: 'Antejardín', kind: 'balcony',
  points: [{ x: 3.3, y: 10.2 }, { x: 5.5, y: 10.2 }, { x: 5.5, y: 9 }, { x: 3.3, y: 9 }],
};
const houseFront: Wall = { id: 'w', a: { x: 0, y: 9 }, b: { x: 5.5, y: 9 }, thickness: 0.2, height: null };

test('railing goes on every open edge that does not touch a wall', () => {
  expect(railingEdges(garden, [houseFront]).map((e) => e.index)).toEqual([0, 1, 3]);
});

test('edges marked open get no railing (e.g. the side towards the driveway)', () => {
  expect(railingEdges({ ...garden, openEdges: [3] }, [houseFront]).map((e) => e.index)).toEqual([0, 1]);
});

test('a garden edge drawn on the outer face of a wall gets no fence, even past the wall line at the corners', () => {
  const back: Wall = { id: 'w', a: { x: 0, y: 1 }, b: { x: 6.15, y: 1 }, thickness: 0.15, height: null };
  const garden: Room = {
    id: 'g', name: 'Jardín', kind: 'balcony',
    points: [{ x: -0.075, y: -1 }, { x: 6.225, y: -1 }, { x: 6.225, y: 0.925 }, { x: -0.075, y: 0.925 }],
  };
  expect(railingEdges(garden, [back]).map((e) => e.index)).toEqual([0, 1, 3]);
});
