// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createEmptyProject } from '../model/defaults';
import { addRoom, addWall, setRoomKind } from '../model/ops';
import { useEditor } from '../store/editorStore';
import PropertiesPanel from '../ui/PropertiesPanel';
import { useToasts } from '../ui/toasts';

const s = () => useEditor.getState();
const floor = () => s().project.floors[0];
const wall = () => floor().walls[0];
const room = () => floor().rooms[0];

beforeEach(() => {
  s().loadProject(createEmptyProject());
  // Wall along y = 3 from x = 0 to 4: left (+perp = +y) looks into the kitchen below it in plan; right is outside.
  s().apply((d) => void addWall(d, d.floors[0].id, { x: 0, y: 3 }, { x: 4, y: 3 }));
  s().apply((d) => void addRoom(d, d.floors[0].id, [{ x: 0, y: 3 }, { x: 4, y: 3 }, { x: 4, y: 6 }, { x: 0, y: 6 }], 'Cocina'));
});

function selectWall() {
  s().select({ kind: 'wall', id: wall().id });
  render(<PropertiesPanel />);
}

function choose(dropdownLabel: string, option: string) {
  fireEvent.click(screen.getByRole('button', { name: dropdownLabel }));
  fireEvent.click(screen.getByRole('option', { name: option }));
}

test('Acabados names the room each face looks into', () => {
  selectWall();
  expect(screen.getByText('Acabados')).toBeInTheDocument();
  expect(screen.getByText('Cara A')).toBeInTheDocument();
  expect(screen.getByText('Cara B')).toBeInTheDocument();
  expect(screen.getByText('Mira a Cocina')).toBeInTheDocument();
  expect(screen.getByText('Mira al exterior')).toBeInTheDocument();
});

test('choosing a finish for one face changes only that face', () => {
  selectWall();
  choose('Acabado de la cara A', 'Ladrillo');
  expect(wall().sides?.left?.finish).toBe('ladrillo');
  expect(wall().sides?.right).toBeUndefined();
  // The dropdown closes after choosing and shows the value.
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(screen.getByRole('button', { name: 'Acabado de la cara A' })).toHaveTextContent('Ladrillo');
});

test('the finish dropdown filters with its search box', () => {
  selectWall();
  fireEvent.click(screen.getByRole('button', { name: 'Acabado de la cara B' }));
  const list = screen.getByRole('listbox');
  fireEvent.change(within(list.parentElement!).getByPlaceholderText('Buscar'), { target: { value: 'pie' } });
  expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual(['Piedra']);
  fireEvent.change(within(list.parentElement!).getByPlaceholderText('Buscar'), { target: { value: 'zzz' } });
  expect(screen.getByText('Nada coincide con tu búsqueda')).toBeInTheDocument();
  fireEvent.keyDown(within(list.parentElement!).getByPlaceholderText('Buscar'), { key: 'Escape' });
  expect(screen.queryByRole('listbox')).toBeNull();
});

test('a swatch paints the face', () => {
  selectWall();
  const caraB = screen.getByRole('group', { name: 'Color de la cara B' });
  fireEvent.click(within(caraB).getByRole('button', { name: 'Terracota' }));
  expect(wall().sides?.right?.color).toBe('#B4613D');
  expect(within(caraB).getByRole('button', { name: 'Terracota' })).toHaveAttribute('aria-pressed', 'true');
});

test('the hex field accepts a colour and flags a wrong one', () => {
  selectWall();
  const input = screen.getByLabelText('Código de color de la cara A') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'verde' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(wall().sides).toBeUndefined();
  expect(input).toHaveClass('invalid');
  fireEvent.change(input, { target: { value: '1f4e5f' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(wall().sides?.left?.color).toBe('#1F4E5F');
});

test('Usar en toda la fachada copies an outside face to every outside face of the floor, with Deshacer', () => {
  s().apply((d) => void addWall(d, d.floors[0].id, { x: 4, y: 6 }, { x: 0, y: 6 })); // left = (0,-1): the kitchen; right outside
  selectWall();
  choose('Acabado de la cara B', 'Piedra');
  fireEvent.click(screen.getByRole('button', { name: 'Usar en toda la fachada' }));
  expect(floor().walls[1].sides?.right).toEqual({ finish: 'piedra' });
  expect(floor().walls[1].sides?.left).toBeUndefined();
  const toast = useToasts.getState().toasts.at(-1)!;
  expect(toast.text).toBe('Acabado aplicado a 2 caras de la fachada');
  act(() => toast.action!.run());
  expect(floor().walls[1].sides).toBeUndefined();
});

test('a room has a Piso material picker', () => {
  s().select({ kind: 'room', id: room().id });
  render(<PropertiesPanel />);
  choose('Piso', 'Porcelanato');
  expect(room().floorMaterial).toBe('porcelanato');
});

test('a balcony has a Baranda switch and a railing colour', () => {
  s().apply((d) => setRoomKind(d, d.floors[0].id, d.floors[0].rooms[0].id, 'balcony'));
  s().select({ kind: 'room', id: room().id });
  render(<PropertiesPanel />);
  const baranda = screen.getByRole('radiogroup', { name: 'Baranda' });
  expect(within(baranda).getByRole('radio', { name: 'Vidrio' })).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(within(baranda).getByRole('radio', { name: 'Celosía' }));
  expect(room().railing).toBe('celosia');
  const colour = screen.getByRole('group', { name: 'Color de la celosía' });
  fireEvent.click(within(colour).getByRole('button', { name: 'Negro' }));
  expect(room().railingColor).toBe('#1E1E1E');
});
