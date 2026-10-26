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
  expect(screen.getByText('12,00 m² · 4,00 × 3,00 m')).toBeInTheDocument();
});

test('hiding the grid removes its lines', async () => {
  const { useGrid } = await import('./gridSettings');
  useGrid.setState({ visible: false, step: 0.5 });
  const { container } = render(<Plan2D />);
  expect(container.querySelectorAll('.grid line')).toHaveLength(0);
  useGrid.setState({ visible: true, step: 0.5 });
});

test('rectangular rooms also show their inside size', () => {
  const { apply, activeFloorId } = useEditor.getState();
  apply((d) => void addRoom(d, activeFloorId, [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }, { x: 0, y: 4 }], 'Dormitorio'));
  render(<Plan2D />);
  expect(screen.getByText('12,00 m² · 3,00 × 4,00 m')).toBeInTheDocument();
});

test('the compass points to the project north', () => {
  useEditor.getState().apply((d) => { d.north = 90; });
  const { container } = render(<Plan2D />);
  const needle = container.querySelector('[data-testid="brujula"] .aguja');
  expect(needle?.getAttribute('transform')).toBe('rotate(90)');
});
