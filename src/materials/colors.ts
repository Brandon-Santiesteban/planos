/** "#abc", "abc", "#AABBCC" … → "#AABBCC"; null when it isn't a hex colour. */
export function normalizeHex(text: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return '#' + h.toUpperCase();
}

/** Wall colour swatches offered in the properties panel. */
export const SWATCHES: { label: string; hex: string }[] = [
  { label: 'Blanco', hex: '#F7F5F0' },
  { label: 'Hueso', hex: '#EDE4D3' },
  { label: 'Hueso arenilla', hex: '#E4D9C6' },
  { label: 'Arena', hex: '#D9C7A5' },
  { label: 'Gris claro', hex: '#C8CBCE' },
  { label: 'Gris grafito', hex: '#4A4F55' },
  { label: 'Terracota', hex: '#B4613D' },
  { label: 'Verde salvia', hex: '#9DAE8A' },
  { label: 'Azul petróleo', hex: '#1F4E5F' },
  { label: 'Madera', hex: '#8A5A3B' },
  { label: 'Negro', hex: '#1E1E1E' },
];
