// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import type { RenderContext } from './renderStore';
import { useRender } from './renderStore';

vi.mock('./RenderWindow', () => ({ default: () => <div role="dialog">Render realista</div> }));
const { default: RenderButtons } = await import('./RenderButtons');

beforeEach(() => useRender.setState({ ctx: null, open: false, preset: 'bueno' }));

test('buttons wait until the 3D view is ready', () => {
  render(<RenderButtons />);
  expect(screen.getByRole('button', { name: 'Tomar foto' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Render' })).toBeDisabled();
});

test('"Render" opens the render window', async () => {
  useRender.setState({ ctx: {} as RenderContext });
  render(<RenderButtons />);
  fireEvent.click(screen.getByRole('button', { name: 'Render' }));
  expect(useRender.getState().open).toBe(true);
  expect(await screen.findByRole('dialog')).toHaveTextContent('Render realista');
});
