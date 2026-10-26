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
  fireEvent.click(screen.getByLabelText('Color #3b3f45'));
  expect(piece().color).toBe('#3b3f45');
  const hex = typeInto('Color', 'zz');
  expect(hex).toHaveClass('invalid');
  typeInto('Color', '#AABBCC');
  expect(piece().color).toBe('#aabbcc');
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
});
