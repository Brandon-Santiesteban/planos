import { formatArea, formatMetres, parseLength } from './units';

test('parseLength accepts comma decimals', () => expect(parseLength('3,5')).toBe(3.5));
test('parseLength accepts centimetres', () => expect(parseLength('350 cm')).toBe(3.5));
test('parseLength accepts metres suffix', () => expect(parseLength('2.75m')).toBe(2.75));
test('parseLength accepts "3,5 m"', () => expect(parseLength('3,5 m')).toBe(3.5));
test('parseLength rejects garbage', () => expect(parseLength('abc')).toBeNull());
test('parseLength rejects negatives', () => expect(parseLength('-2')).toBeNull());
test('parseLength rejects zero', () => expect(parseLength('0')).toBeNull());
test('parseLength rejects empty', () => expect(parseLength('')).toBeNull());
test('formatMetres uses comma and 2 decimals', () => expect(formatMetres(3.5)).toBe('3,50 m'));
test('formatArea uses m²', () => expect(formatArea(12.345)).toBe('12,35 m²'));
