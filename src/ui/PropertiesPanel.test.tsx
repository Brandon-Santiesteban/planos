// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { wallLength } from '../geometry/walls';
import { createEmptyProject } from '../model/defaults';
import { addOpening, addRoom, addWall } from '../model/ops';
import { useEditor } from '../store/editorStore';
import PropertiesPanel from './PropertiesPanel';
import { useToasts } from './toasts';

const s = () => useEditor.getState();
const wall = () => s().project.floors[0].walls[0];

beforeEach(() => {
  s().loadProject(createEmptyProject());
  s().apply((d) => void addWall(d, d.floors[0].id, { x: 0, y: 0 }, { x: 4, y: 0 }));
  s().select({ kind: 'wall', id: wall().id });
});

function chooseKind(label: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Tipo' }));
  fireEvent.click(screen.getByRole('option', { name: label }));
}

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

test('focusing and leaving a field without editing changes nothing', () => {
  s().loadProject(createEmptyProject());
  s().apply((d) => void addWall(d, d.floors[0].id, { x: 0, y: 0 }, { x: 1, y: 1 })); // 1.41421… m
  s().select({ kind: 'wall', id: wall().id });
  const pastBefore = s().past.length;
  render(<PropertiesPanel />);
  const input = screen.getByLabelText('Longitud');
  fireEvent.focus(input);
  fireEvent.blur(input);
  expect(wallLength(wall())).toBeCloseTo(Math.SQRT2, 6);
  expect(s().past.length).toBe(pastBefore);
});

test('a refused edit puts the real value back in the field', () => {
  s().apply((d) => void addOpening(d, d.floors[0].id, wall().id, 'door', 2));
  s().select({ kind: 'opening', id: s().project.floors[0].openings[0].id });
  render(<PropertiesPanel />);
  const input = typeInto('Ancho', '9');
  expect(s().project.floors[0].openings[0].width).toBe(0.8);
  expect(input.value).toBe('0,80');
});

test('Eliminar deletes the wall and offers Deshacer', () => {
  render(<PropertiesPanel />);
  fireEvent.click(screen.getByText('Eliminar'));
  expect(s().project.floors[0].walls).toHaveLength(0);
  const toast = useToasts.getState().toasts.at(-1)!;
  expect(toast.text).toBe('Muro eliminado');
  toast.action!.run();
  expect(s().project.floors[0].walls).toHaveLength(1);
});

test('a room can be renamed and turned into a balcony', () => {
  s().apply((d) => void addRoom(d, d.floors[0].id, [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }], 'Habitación 1'));
  const room = () => s().project.floors[0].rooms[0];
  s().select({ kind: 'room', id: room().id });
  render(<PropertiesPanel />);
  typeInto('Nombre', 'Balcón');
  chooseKind('Balcón');
  expect(room().name).toBe('Balcón');
  expect(room().kind).toBe('balcony');
  expect(screen.getByText('6,00 m²')).toBeInTheDocument();
});

test('a room can become a roof with its own height', () => {
  s().apply((d) => void addRoom(d, d.floors[0].id, [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }], 'Techo patio'));
  const room = () => s().project.floors[0].rooms[0];
  s().select({ kind: 'room', id: room().id });
  render(<PropertiesPanel />);
  chooseKind('Cubierta');
  expect(room().kind).toBe('roof');
  typeInto('Altura de la cubierta', '3,1');
  expect(room().height).toBeCloseTo(3.1);
});

test('a room can become a U-shaped stairs going up to the right', () => {
  s().apply((d) => void addRoom(d, d.floors[0].id, [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 3 }, { x: 0, y: 3 }], 'Escalera'));
  const room = () => s().project.floors[0].rooms[0];
  s().select({ kind: 'room', id: room().id });
  render(<PropertiesPanel />);
  expect(screen.queryByRole('combobox', { name: 'Sube hacia' })).toBeNull();
  chooseKind('Escalera');
  expect(room().kind).toBe('stairs');
  expect(screen.getByRole('heading', { name: 'Escalera' })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Sube hacia' })).toHaveTextContent('Arriba');
  fireEvent.click(screen.getByRole('combobox', { name: 'Sube hacia' }));
  fireEvent.click(screen.getByRole('option', { name: 'Derecha' }));
  expect(room().up).toBe('e');
  expect(screen.getByRole('radio', { name: 'Recta' })).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(screen.getByRole('radio', { name: 'En U' }));
  expect(room().stairShape).toBe('u');
});

test('Invertir apertura flips the swing of a door', () => {
  s().apply((d) => void addOpening(d, d.floors[0].id, wall().id, 'door', 2));
  s().select({ kind: 'opening', id: s().project.floors[0].openings[0].id });
  render(<PropertiesPanel />);
  fireEvent.click(screen.getByRole('button', { name: 'Invertir apertura' }));
  expect(s().project.floors[0].openings[0].flip).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Invertir apertura' }));
  expect(s().project.floors[0].openings[0].flip).toBe(false);
});

test('windows have no Invertir apertura', () => {
  s().apply((d) => void addOpening(d, d.floors[0].id, wall().id, 'window', 2));
  s().select({ kind: 'opening', id: s().project.floors[0].openings[0].id });
  render(<PropertiesPanel />);
  expect(screen.queryByRole('button', { name: 'Invertir apertura' })).toBeNull();
});
