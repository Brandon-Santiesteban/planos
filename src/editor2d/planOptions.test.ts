import { usePlanOptions } from './planOptions';

test('square metres start hidden', () => {
  expect(usePlanOptions.getState().showArea).toBe(false);
});

test('the option can be turned on', () => {
  usePlanOptions.getState().setShowArea(true);
  expect(usePlanOptions.getState().showArea).toBe(true);
});
