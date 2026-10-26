// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { createEmptyProject } from '../model/defaults';
import { useEditor } from '../store/editorStore';
import OrientationPanel from './OrientationPanel';

beforeEach(() => useEditor.getState().loadProject(createEmptyProject()));

test('turning the compass says where the front faces', () => {
  render(<OrientationPanel />);
  expect(screen.getByText(/mira al Norte/)).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Girar el norte 15° a la derecha'));
  expect(useEditor.getState().project.north).toBe(15);
  const input = screen.getByLabelText('Norte (grados)');
  fireEvent.change(input, { target: { value: '180' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(useEditor.getState().project.north).toBe(180);
  expect(screen.getByText(/mira al Sur/)).toBeInTheDocument();
});
