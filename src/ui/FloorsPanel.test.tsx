// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import Plan2D from '../editor2d/Plan2D';
import { createEmptyProject } from '../model/defaults';
import { addWall } from '../model/ops';
import { useEditor } from '../store/editorStore';
import FloorsPanel from './FloorsPanel';

const s = () => useEditor.getState();
beforeEach(() => s().loadProject(createEmptyProject()));

test('Añadir planta adds and activates Planta 1', () => {
  render(<FloorsPanel />);
  fireEvent.click(screen.getByText('Añadir planta'));
  expect(screen.getByText('Planta 1')).toBeInTheDocument();
  expect(s().activeFloorId).toBe(s().project.floors[1].id);
});

test('Eliminar is disabled with a single floor', () => {
  render(<FloorsPanel />);
  expect(screen.getByText('Eliminar')).toBeDisabled();
});

test('deleting the active floor activates the one below', () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<FloorsPanel />);
  fireEvent.click(screen.getByText('Añadir planta'));
  fireEvent.click(screen.getByText('Eliminar'));
  expect(s().project.floors).toHaveLength(1);
  expect(s().activeFloorId).toBe(s().project.floors[0].id);
});

test('floors are listed top to bottom', () => {
  render(<FloorsPanel />);
  fireEvent.click(screen.getByText('Añadir planta'));
  const names = screen.getAllByRole('listitem').map((li) => li.querySelector('.floor-name')?.textContent);
  expect(names).toEqual(['Planta 1', 'Planta baja']);
});

test('the floor below is drawn as ghost walls', () => {
  s().apply((d) => void addWall(d, d.floors[0].id, { x: 0, y: 0 }, { x: 4, y: 0 }));
  render(<FloorsPanel />);
  fireEvent.click(screen.getByText('Añadir planta'));
  const { container } = render(<Plan2D />);
  expect(container.querySelectorAll('polygon.wall.ghost')).toHaveLength(1);
});
