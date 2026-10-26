// @vitest-environment jsdom
import { applyTheme, initialTheme } from './theme';

test('dark mode sets data-tema="oscuro" on the root', () => {
  applyTheme('oscuro');
  expect(document.documentElement.dataset.tema).toBe('oscuro');
  applyTheme('claro');
  expect(document.documentElement.dataset.tema).toBeUndefined();
});

test('a stored choice wins over the system preference', () => {
  expect(initialTheme('oscuro', false)).toBe('oscuro');
  expect(initialTheme('claro', true)).toBe('claro');
});

test('without a stored choice the system preference is used', () => {
  expect(initialTheme(null, true)).toBe('oscuro');
  expect(initialTheme(null, false)).toBe('claro');
});
