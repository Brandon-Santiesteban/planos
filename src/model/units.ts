/** Parses a length typed by the user into metres. Accepts "3,5", "3.5", "3,5 m", "350 cm". */
export function parseLength(text: string): number | null {
  const m = text.trim().toLowerCase().replace(',', '.').match(/^(\d+(?:\.\d+)?|\.\d+)\s*(m|cm)?$/);
  if (!m) return null;
  const value = Number(m[1]) / (m[2] === 'cm' ? 100 : 1);
  return value > 0 && Number.isFinite(value) ? value : null;
}

function fixed2(n: number): string {
  return (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2).replace('.', ',');
}

export const formatMetres = (m: number): string => `${fixed2(m)} m`;
export const formatArea = (m2: number): string => `${fixed2(m2)} m²`;
