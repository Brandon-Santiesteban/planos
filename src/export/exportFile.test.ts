import type { Floor, Project } from '../model/types';
import { buildExport, exportFileName, floorsToExport } from './exportFile';

const floor = (id: string, name: string, walls = 1): Floor => ({
  id, name, height: 2.6, background: null, furniture: [], openings: [], rooms: [],
  walls: Array.from({ length: walls }, (_, i) => ({ id: `${id}${i}`, a: { x: 0, y: i }, b: { x: 3, y: i }, thickness: 0.15, height: null })),
});

const project: Project = {
  version: 1, id: 'p', name: 'Casa: Sur/Norte', north: 0,
  floors: [floor('a', 'Planta baja'), floor('b', 'Vacía', 0), floor('c', 'Segundo piso')],
};

test('file names are «<proyecto> - <planta>» without characters Windows refuses', () => {
  expect(exportFileName('Casa: Sur/Norte', 'Planta baja', 'pdf')).toBe('Casa Sur-Norte - Planta baja.pdf');
  expect(exportFileName('  ', 'Planta baja', 'dxf')).toBe('Plano - Planta baja.dxf');
});

test('the current floor, or every floor that has something drawn', () => {
  expect(floorsToExport(project, 'c', 'actual').map((f) => f.name)).toEqual(['Segundo piso']);
  expect(floorsToExport(project, 'b', 'actual')).toEqual([]);
  expect(floorsToExport(project, 'a', 'todas').map((f) => f.name)).toEqual(['Planta baja', 'Segundo piso']);
});

test('buildExport names the file after the project and the floor', async () => {
  const dxf = await buildExport(project, 'a', 'actual', 'dxf');
  expect(dxf.name).toBe('Casa Sur-Norte - Planta baja.dxf');
  expect(dxf.blob.type).toBe('application/dxf');
  const pdf = await buildExport(project, 'a', 'todas', 'pdf');
  expect(pdf.name).toBe('Casa Sur-Norte - Todas las plantas.pdf');
  expect(pdf.blob.type).toBe('application/pdf');
  expect(pdf.blob.size).toBeGreaterThan(1000);
});

test('buildExport refuses an empty selection', async () => {
  await expect(buildExport(project, 'b', 'actual', 'pdf')).rejects.toThrow('nada dibujado');
});
