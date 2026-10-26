const two = (n: number) => String(n).padStart(2, '0');

/** `<proyecto> - dd-mm-aaaa hh.mm.png`, safe for Windows and macOS file names. */
export function photoFileName(projectName: string, when: Date, ext = 'png'): string {
  // eslint-disable-next-line no-control-regex
  const safe = projectName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').trim() || 'Casa';
  const date = `${two(when.getDate())}-${two(when.getMonth() + 1)}-${when.getFullYear()}`;
  const time = `${two(when.getHours())}.${two(when.getMinutes())}`;
  return `${safe} - ${date} ${time}.${ext}`;
}
