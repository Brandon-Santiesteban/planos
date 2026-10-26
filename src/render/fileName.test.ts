import { describe, expect, it } from 'vitest';
import { photoFileName } from './fileName';

describe('photoFileName', () => {
  it('uses the project name and a dd-mm-aaaa hh.mm stamp', () => {
    expect(photoFileName('Casa Etapa 1', new Date(2026, 9, 5, 9, 7))).toBe('Casa Etapa 1 - 05-10-2026 09.07.png');
  });

  it('replaces characters that are not allowed in file names', () => {
    expect(photoFileName('Casa: "nueva" / 2*', new Date(2026, 0, 1, 23, 59))).toBe('Casa- -nueva- - 2- - 01-01-2026 23.59.png');
  });

  it('falls back to "Casa" when the name is empty', () => {
    expect(photoFileName('   ', new Date(2026, 11, 31, 0, 0))).toBe('Casa - 31-12-2026 00.00.png');
  });

  it('accepts another extension', () => {
    expect(photoFileName('Plano', new Date(2026, 1, 2, 3, 4), 'jpg')).toBe('Plano - 02-02-2026 03.04.jpg');
  });
});
