import { createEmptyProject } from '../model/defaults';
import { addRoom, setRoomKind } from '../model/ops';
import { outdoorLights, roomLights } from './roomLights';

test('stairs get no ceiling light and no outdoor light', () => {
  const p = createEmptyProject();
  const g = p.floors[0].id;
  const s = addRoom(p, g, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 3 }, { x: 0, y: 3 }], 'Escalera')!;
  setRoomKind(p, g, s, 'stairs');
  expect(roomLights(p, [g])).toEqual([]);
  expect(outdoorLights(p, [g])).toEqual([]);
});
