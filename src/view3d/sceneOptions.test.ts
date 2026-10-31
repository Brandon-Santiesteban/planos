import { useSceneOptions } from './sceneOptions';

test('grass is on and it is morning by default', () => {
  expect(useSceneOptions.getState()).toMatchObject({ grass: true, time: 'manana' });
});

test('the time of day can be changed', () => {
  useSceneOptions.getState().set({ time: 'noche' });
  expect(useSceneOptions.getState().time).toBe('noche');
});

test('the room lights are on by default and can be left to the neons only', () => {
  expect(useSceneOptions.getState().lights).toBe('on');
  useSceneOptions.getState().set({ lights: 'neon' });
  expect(useSceneOptions.getState().lights).toBe('neon');
});
