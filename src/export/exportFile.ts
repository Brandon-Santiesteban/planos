import type { Floor, Project } from '../model/types';

export type ExportScope = 'actual' | 'todas';
export type ExportFormat = 'pdf' | 'dxf';

export const hasContent = (f: Floor) => f.walls.length + f.rooms.length + f.furniture.length > 0;

/** The floor being edited, or every floor that has something drawn (empty ones would be blank sheets). */
export function floorsToExport(project: Project, activeFloorId: string, scope: ExportScope): Floor[] {
  const floors = scope === 'actual' ? project.floors.filter((f) => f.id === activeFloorId) : project.floors;
  return floors.filter(hasContent);
}

const clean = (s: string) => s.replace(/[\\/]+/g, '-').replace(/[<>:"|?*\x00-\x1f]+/g, '').replace(/\s+/g, ' ').trim();

/** «<proyecto> - <planta>.<ext>», safe as a Windows file name. */
export function exportFileName(projectName: string, label: string, ext: ExportFormat): string {
  return `${clean(projectName) || 'Plano'} - ${clean(label) || 'Planta'}.${ext}`;
}

export async function buildExport(project: Project, activeFloorId: string, scope: ExportScope, format: ExportFormat): Promise<{ name: string; blob: Blob }> {
  const floors = floorsToExport(project, activeFloorId, scope);
  if (floors.length === 0) throw new Error('No hay nada dibujado para exportar en esta planta');
  const label = scope === 'todas' && project.floors.length > 1 ? 'Todas las plantas' : floors[0].name;
  const name = exportFileName(project.name, label, format);
  if (format === 'pdf') {
    const { exportPdf } = await import('./pdf'); // jsPDF only loads when someone exports
    return { name, blob: new Blob([exportPdf(project, floors)], { type: 'application/pdf' }) };
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
