// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { WalkButton, WalkHint } from './WalkOverlay';
import { useWalk } from './walkStore';

beforeEach(() => useWalk.setState({ walking: false, looking: false }));

test('Caminar enters walk mode and Salir de caminar leaves it', () => {
  render(<WalkButton />);
  fireEvent.click(screen.getByRole('button', { name: 'Caminar' }));
  expect(useWalk.getState().walking).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Salir de caminar' }));
  expect(useWalk.getState().walking).toBe(false);
});

test('while walking a hint explains the controls', () => {
  const { rerender } = render(<WalkHint />);
  expect(screen.queryByText(/WASD/)).toBeNull();
  useWalk.setState({ walking: true });
  rerender(<WalkHint />);
  expect(screen.getByText('Clic para mirar · WASD para moverte · Shift para correr · Esc suelta el ratón')).toBeInTheDocument();
});
