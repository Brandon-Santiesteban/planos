// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEditor } from '../store/editorStore';
import { useToasts } from '../ui/toasts';
import ExportButton from './ExportDialog';
import * as exportFile from './exportFile';

beforeEach(() => {
  act(() => {
    useEditor.getState().apply((d) => {
      d.name = 'Mi casa';
      d.floors[0].name = 'Planta baja';
      d.floors[0].walls = [{ id: 'w', a: { x: 0, y: 0 }, b: { x: 3, y: 0 }, thickness: 0.15, height: null }];
    });
  });
  useToasts.setState({ toasts: [] });
});

afterEach(() => vi.restoreAllMocks());

test('opens a window with floor and format switches and downloads the chosen file', async () => {
  const download = vi.spyOn(exportFile, 'downloadBlob').mockImplementation(() => {});
  render(<ExportButton />);
  fireEvent.click(screen.getByRole('button', { name: /Exportar/ }));
  expect(screen.getByRole('dialog', { name: 'Exportar planos' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Planta actual' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByRole('radio', { name: 'PDF a escala' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.queryByRole('radio', { name: 'Milímetros' })).toBeNull();
  fireEvent.click(screen.getByRole('radio', { name: 'DXF para arquitecto' }));
  expect(screen.getByRole('radio', { name: 'Milímetros' })).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(screen.getByRole('radio', { name: 'Metros' }));
  const build = vi.spyOn(exportFile, 'buildExport');
  fireEvent.click(screen.getByRole('button', { name: /Descargar/ }));
  await waitFor(() => expect(build).toHaveBeenCalled());
  expect(build.mock.calls[0][5]).toEqual({ dxfUnits: 'm' });
  await waitFor(() => expect(download).toHaveBeenCalled());
  expect(download.mock.calls[0][0]).toBe('Mi casa - Planta baja.dxf');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(useToasts.getState().toasts.at(-1)).toMatchObject({ kind: 'ok', text: 'Descargado «Mi casa - Planta baja.dxf»' });
});

test('an error stays as a copyable error toast', async () => {
  vi.spyOn(exportFile, 'buildExport').mockRejectedValue(new Error('se rompió'));
  render(<ExportButton />);
  fireEvent.click(screen.getByRole('button', { name: /Exportar/ }));
  fireEvent.click(screen.getByRole('button', { name: /Descargar/ }));
  await waitFor(() => expect(useToasts.getState().toasts.at(-1)?.kind).toBe('error'));
  expect(useToasts.getState().toasts.at(-1)).toMatchObject({ text: 'No se pudo exportar el plano', detail: 'se rompió' });
});

test('an empty floor cannot be exported and says why', () => {
  act(() => useEditor.getState().apply((d) => { d.floors[0].walls = []; d.floors[0].rooms = []; d.floors[0].furniture = []; }));
  render(<ExportButton />);
  fireEvent.click(screen.getByRole('button', { name: /Exportar/ }));
  expect(screen.getByRole('button', { name: /Nada que exportar/ })).toBeDisabled();
});

test('Esc closes the window', () => {
  render(<ExportButton />);
  fireEvent.click(screen.getByRole('button', { name: /Exportar/ }));
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('PDF: paper, scale, dimensions and furniture choices reach the export (A1, automatic, no furniture by default)', async () => {
  vi.spyOn(exportFile, 'downloadBlob').mockImplementation(() => {});
  const build = vi.spyOn(exportFile, 'buildExport').mockResolvedValue({ name: 'x.pdf', blob: new Blob([]) });
  render(<ExportButton />);
  fireEvent.click(screen.getByRole('button', { name: /Exportar/ }));
  fireEvent.click(screen.getByRole('radio', { name: 'PDF a escala' }));
  expect(screen.getByRole('radio', { name: 'A1' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByRole('radio', { name: 'Automática' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByRole('checkbox', { name: 'Incluir muebles' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Incluir cotas' })).toBeChecked();
  fireEvent.click(screen.getByRole('radio', { name: 'A3' }));
  fireEvent.click(screen.getByRole('radio', { name: '1:75' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Incluir muebles' }));
  fireEvent.click(screen.getByRole('button', { name: /Descargar/ }));
  await waitFor(() => expect(build).toHaveBeenCalled());
  expect(build.mock.calls[0][4]).toEqual({ paper: 'A3', scale: 75, furniture: true, dimensions: true, wallDimensions: false });
});
