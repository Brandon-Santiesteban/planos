// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { createEmptyProject } from '../model/defaults';
import { addFurniture, furnitureFromCatalog } from '../model/furnitureOps';
import { useEditor } from '../store/editorStore';
import PropertiesPanel from '../ui/PropertiesPanel';
import { useToasts } from '../ui/toasts';
import { usePlacement } from './placeTool';

const s = () => useEditor.getState();
const piece = () => s().project.floors[0].furniture[0];

function typeInto(label: string, text: string) {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: 'Enter' });
  return input;
}

beforeEach(() => {
  s().loadProject(createEmptyProject());
  s().setTool('select');
  s().apply((d) => void addFurniture(d, d.floors[0].id, furnitureFromCatalog('escritorio', { x: 1, y: 1 })));
  s().select({ kind: 'furniture', id: piece().id });
  usePlacement.setState({ itemId: null, query: '', category: null });
});

test('the furniture panel edits sizes, elevation, rotation and colour', () => {
  render(<PropertiesPanel />);
  expect(screen.getByText('Escritorio')).toBeInTheDocument();
  typeInto('Ancho', '1,8');
  typeInto('Fondo', '75 cm');
  typeInto('Alto', '0,74');
  typeInto('Elevación', '0');
  expect(piece()).toMatchObject({ width: 1.8, depth: 0.75, height: 0.74, elevation: 0 });
  typeInto('Elevación', '0,2');
  expect(piece().elevation).toBeCloseTo(0.2);
  fireEvent.click(screen.getByText('+90°'));
  expect(piece().rotation).toBe(90);
  fireEvent.click(screen.getByText('−90°'));
  fireEvent.click(screen.getByText('−90°'));
  expect(piece().rotation).toBe(270);
  typeInto('Rotación', '45');
  expect(piece().rotation).toBe(45);
  fireEvent.click(screen.getByLabelText('Grafito (#3b3f45)'));
  expect(piece().color).toBe('#3b3f45');
  expect(screen.getByText('Grafito')).toBeInTheDocument();
  const hex = typeInto('Color', 'zz');
  expect(hex).toHaveClass('invalid');
  typeInto('Color', '#AABBCC');
  expect(piece().color).toBe('#aabbcc');
  // The colour now shows up among the ones used in the house, and «Original» puts the catalogue colour back.
  expect(screen.getByRole('group', { name: 'Usados en esta casa' })).toContainElement(screen.getByLabelText('#aabbcc'));
  fireEvent.click(screen.getByText('Original'));
  expect(piece().color).toBeUndefined();
});

test('one colour for every piece of the same kind, or for a multiple selection', () => {
  s().apply((d) => void addFurniture(d, d.floors[0].id, furnitureFromCatalog('escritorio', { x: 4, y: 1 })));
  s().apply((d) => void addFurniture(d, d.floors[0].id, furnitureFromCatalog('cama-doble', { x: 4, y: 5 })));
  const { rerender } = render(<PropertiesPanel />);
  fireEvent.click(screen.getByLabelText('Nogal (#7a5a3f)'));
  fireEvent.click(screen.getByText(/Mismo color a los 2/));
  expect(s().project.floors[0].furniture.map((f) => f.color)).toEqual(['#7a5a3f', '#7a5a3f', '#d9cfc0']); // the bed keeps its own
  s().selectGroup(s().project.floors[0].furniture.map((f) => ({ kind: 'furniture' as const, id: f.id })));
  rerender(<PropertiesPanel />);
  expect(screen.getByText('Varios colores')).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Salvia (#8a9a7b)'));
  expect(s().project.floors[0].furniture.map((f) => f.color)).toEqual(['#8a9a7b', '#8a9a7b', '#8a9a7b']);
});

test('Duplicar copies and Eliminar removes with Deshacer', () => {
  render(<PropertiesPanel />);
  fireEvent.click(screen.getByText('Duplicar'));
  expect(s().project.floors[0].furniture).toHaveLength(2);
  fireEvent.click(screen.getByText('Eliminar'));
  expect(s().project.floors[0].furniture).toHaveLength(1);
  const toast = useToasts.getState().toasts.at(-1)!;
  expect(toast.text).toBe('Mueble eliminado');
  toast.action!.run();
  expect(s().project.floors[0].furniture).toHaveLength(2);
});

test('the Muebles tool shows the catalog: search, categories and choosing a piece', () => {
  s().setTool('furniture');
  render(<PropertiesPanel />);
  fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'nevera' } });
  expect(screen.getByTestId('mueble-nevera')).toBeInTheDocument();
  expect(screen.queryByTestId('mueble-cama-doble')).toBeNull();
  fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'xyz' } });
  expect(screen.getByText('Nada coincide con tu búsqueda')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: /^Parqueadero/ }));
  expect(screen.getByTestId('mueble-carro')).toBeInTheDocument();
  expect(screen.queryByTestId('mueble-nevera')).toBeNull();
  fireEvent.click(screen.getByTestId('mueble-carro'));
  expect(usePlacement.getState().itemId).toBe('carro');
  expect(screen.getByText(/4,50 × 1,80 m/)).toBeInTheDocument();
}, 30000); // renders the whole catalog several times: slow on a busy machine

test('a gate can be opened and closed from its panel', () => {
  s().apply((d) => void addFurniture(d, d.floors[0].id, furnitureFromCatalog('porton-telescopico', { x: 1.65, y: 10 })));
  const gate = () => s().project.floors[0].furniture[1];
  s().select({ kind: 'furniture', id: gate().id });
  render(<PropertiesPanel />);
  const toggle = screen.getByRole('checkbox', { name: 'Portón abierto' });
  fireEvent.click(toggle);
  expect(gate().open).toBe(true);
  fireEvent.click(toggle);
  expect(gate().open).toBe(false);
});
