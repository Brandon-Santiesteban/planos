// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { createEmptyProject } from '../model/defaults';
import { addRoom, addWall } from '../model/ops';
import { useEditor } from '../store/editorStore';
import Plan2D from './Plan2D';

beforeEach(() => useEditor.getState().loadProject(createEmptyProject()));

test('renders a wall with its length label', () => {
  const { apply, activeFloorId } = useEditor.getState();
  apply((d) => void addWall(d, activeFloorId, { x: 0, y: 0 }, { x: 4, y: 0 }));
  const { container } = render(<Plan2D />);
  expect(screen.getByText('4,00 m')).toBeInTheDocument();
  expect(container.querySelectorAll('polygon.wall')).toHaveLength(1);
});

test('renders a room with name and area', () => {
  const { apply, activeFloorId } = useEditor.getState();
  apply((d) => void addRoom(d, activeFloorId, [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }], 'Sala'));
  render(<Plan2D />);
  expect(screen.getByText('Sala')).toBeInTheDocument();
  expect(screen.getByText('12,00 m²')).toBeInTheDocument();
});
