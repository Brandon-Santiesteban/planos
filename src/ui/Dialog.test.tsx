// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { askConfirm, DialogHost } from './Dialog';

test('resolves true when the main button is pressed', async () => {
  render(<DialogHost />);
  let answer: Promise<boolean>;
  act(() => {
    answer = askConfirm({ title: '¿Empezar de nuevo?', text: 'Hay cambios sin guardar.', confirmLabel: 'Empezar' });
  });
  expect(screen.getByRole('dialog')).toHaveTextContent('¿Empezar de nuevo?');
  fireEvent.click(screen.getByText('Empezar'));
  await expect(answer!).resolves.toBe(true);
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('Esc cancels', async () => {
  render(<DialogHost />);
  let answer: Promise<boolean>;
  act(() => {
    answer = askConfirm({ title: 'T', text: 'x', confirmLabel: 'OK' });
  });
  fireEvent.keyDown(window, { key: 'Escape' });
  await expect(answer!).resolves.toBe(false);
});

test('Enter confirms a normal dialog but not a danger one', async () => {
  render(<DialogHost />);
  let normal: Promise<boolean>;
  act(() => {
    normal = askConfirm({ title: 'T', text: 'x', confirmLabel: 'OK' });
  });
  fireEvent.keyDown(window, { key: 'Enter' });
  await expect(normal!).resolves.toBe(true);

  act(() => {
    void askConfirm({ title: 'Borrar', text: 'x', confirmLabel: 'Eliminar', danger: true });
  });
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});
