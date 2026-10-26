// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { createEmptyProject } from '../../model/defaults';
import { addOpening, addWall, toggleDoorFlip } from '../../model/ops';
import OpeningsLayer from './OpeningsLayer';

function leafTipY(flip: boolean) {
  const p = createEmptyProject();
  const f = p.floors[0].id;
  const w = addWall(p, f, { x: 0, y: 0 }, { x: 4, y: 0 })!;
  const d = addOpening(p, f, w, 'door', 2)!;
  if (flip) toggleDoorFlip(p, f, d);
  const { container } = render(<svg><OpeningsLayer floor={p.floors[0]} selection={null} /></svg>);
  return Number(container.querySelector('.door-leaf')!.getAttribute('y2'));
}

test('a flipped door swings to the other side of the wall', () => {
  expect(leafTipY(false)).toBeGreaterThan(0.5);
  expect(leafTipY(true)).toBeLessThan(-0.5);
});
