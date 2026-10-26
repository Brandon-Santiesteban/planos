import { gridStepFor } from './gridStep';

test('normal zoom snaps to half metres', () => expect(gridStepFor(60)).toBe(0.5));
test('zoomed in snaps to 10 cm', () => expect(gridStepFor(200)).toBe(0.1));
test('zoomed out snaps to whole metres', () => expect(gridStepFor(20)).toBe(1));
