import { useSceneOptions } from './sceneOptions';

test('grass is on and it is morning by default', () => {
  expect(useSceneOptions.getState()).toMatchObject({ grass: true, time: 'manana' });
});

test('the time of day can be changed', () => {
  useSceneOptions.getState().set({ time: 'noche' });
  expect(useSceneOptions.getState().time).toBe('noche');
});
