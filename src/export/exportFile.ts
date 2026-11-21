import type { Floor, Project } from '../model/types';
import type { PaperSize, ScaleChoice } from './pdf';

export type ExportScope = 'actual' | 'todas';
export type ExportFormat = 'pdf' | 'dxf' | 'texto';
const EXT: Record<ExportFormat, string> = { pdf: 'pdf', dxf: 'dxf', texto: 'txt' };

export const hasContent = (f: Floor) => f.walls.length + f.rooms.length + f.furniture.length > 0;

/** The floor being edited, or every floor that has something drawn (empty ones would be blank sheets). */
export function floorsToExport(project: Project, activeFloorId: string, scope: ExportScope): Floor[] {
  const floors = scope === 'actual' ? project.floors.filter((f) => f.id === activeFloorId) : project.floors;
  return floors.filter(hasContent);
}

const clean = (s: string) => s.replace(/[\\/]+/g, '-').replace(/[<>:"|?*\x00-\x1f]+/g, '').replace(/\s+/g, ' ').trim();

/** «<proyecto> - <planta>.<ext>», safe as a Windows file name. */
export function exportFileName(projectName: string, label: string, format: ExportFormat): string {
  return `${clean(projectName) || 'Plano'} - ${clean(label) || 'Planta'}.${EXT[format]}`;
}

/** PDF choices from the export window. */
export interface PdfChoices { paper: PaperSize; scale: ScaleChoice; furniture: boolean; dimensions: boolean; wallDimensions: boolean }

export const PDF_DEFAULTS: PdfChoices = { paper: 'A1', scale: 'auto', furniture: false, dimensions: true, wallDimensions: false };

export async function buildExport(
  project: Project, activeFloorId: string, scope: ExportScope, format: ExportFormat, pdf: PdfChoices = PDF_DEFAULTS,
): Promise<{ name: string; blob: Blob }> {
  const floors = floorsToExport(project, activeFloorId, scope);
  if (floors.length === 0) throw new Error('No hay nada dibujado para exportar en esta planta');
  const label = scope === 'todas' && project.floors.length > 1 ? 'Todas las plantas' : floors[0].name;
  const name = exportFileName(project.name, label, format);
  if (format === 'pdf') {
    const { exportPdf } = await import('./pdf'); // jsPDF only loads when someone exports
    const bytes = exportPdf(project, floors, {
      paper: pdf.paper, scaleChoice: pdf.scale, furniture: pdf.furniture, dimensions: pdf.dimensions, wallDimensions: pdf.wallDimensions,
    });
    return { name, blob: new Blob([bytes], { type: 'application/pdf' }) };
  }
  if (format === 'texto') {
    const { exportText } = await import('./texto');
    return { name, blob: new Blob([exportText(project, floors)], { type: 'text/plain;charset=utf-8' }) };
  }
  const { exportDxf } = await import('./dxf');
  return { name, blob: new Blob([exportDxf(project, floors)], { type: 'application/dxf' }) };
}

export function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
