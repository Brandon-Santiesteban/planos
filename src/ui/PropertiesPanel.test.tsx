import { fireEvent, render, screen } from '@testing-library/react';
import { wallLength } from '../geometry/walls';
import { createEmptyProject } from '../model/defaults';
import { addRoom, addWall } from '../model/ops';
import { useEditor } from '../store/editorStore';
import PropertiesPanel from './PropertiesPanel';

const s = () => useEditor.getState();
const wall = () => s().project.floors[0].walls[0];

beforeEach(() => {
  s().loadProject(createEmptyProject());
  s().apply((d) => void addWall(d, d.floors[0].id, { x: 0, y: 0 }, { x: 4, y: 0 }));
  s().select({ kind: 'wall', id: wall().id });
});

function typeInto(label: string, text: string) {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: 'Enter' });
  return input;
}

test('editing Longitud changes the wall length', () => {
  render(<PropertiesPanel />);
  typeInto('Longitud', '3');
  expect(wallLength(wall())).toBeCloseTo(3);
});

test('invalid Longitud is flagged and not applied', () => {
  render(<PropertiesPanel />);
  const input = typeInto('Longitud', 'x');
  expect(wallLength(wall())).toBeCloseTo(4);
  expect(input).toHaveClass('invalid');
});

test('Grosor accepts comma decimals', () => {
  render(<PropertiesPanel />);
  typeInto('Grosor', '0,2');
  expect(wall().thickness).toBeCloseTo(0.2);
});

test('Eliminar deletes the wall', () => {
  render(<PropertiesPanel />);
  fireEvent.click(screen.getByText('Eliminar'));
  expect(s().project.floors[0].walls).toHaveLength(0);
});

test('a room can be renamed and turned into a balcony', () => {
  s().apply((d) => void addRoom(d, d.floors[0].id, [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }], 'Habitación 1'));
  const room = () => s().project.floors[0].rooms[0];
  s().select({ kind: 'room', id: room().id });
  render(<PropertiesPanel />);
  typeInto('Nombre', 'Balcón');
  fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'balcony' } });
  expect(room().name).toBe('Balcón');
  expect(room().kind).toBe('balcony');
  expect(screen.getByText('6,00 m²')).toBeInTheDocument();
});
