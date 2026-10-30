// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import Dropdown from './Dropdown';

const OPTIONS = [
  { value: 'room', label: 'Habitación' },
  { value: 'balcony', label: 'Balcón' },
  { value: 'roof', label: 'Cubierta' },
  { value: 'stairs', label: 'Escalera' },
];

function setup(value = 'room') {
  const onChange = vi.fn();
  render(<Dropdown label="Tipo" value={value} options={OPTIONS} onChange={onChange} />);
  return { onChange, field: screen.getByRole('combobox', { name: 'Tipo' }) };
}

afterEach(() => vi.useRealTimers());

test('shows the chosen option and opens on click with a check on it', () => {
  const { field } = setup('balcony');
  expect(field).toHaveTextContent('Balcón');
  expect(screen.queryByRole('listbox')).toBeNull();
  fireEvent.click(field);
  expect(field).toHaveAttribute('aria-expanded', 'true');
  const chosen = screen.getByRole('option', { name: 'Balcón' });
  expect(chosen).toHaveAttribute('aria-selected', 'true');
  expect(chosen.querySelector('svg')).not.toBeNull();
  expect(screen.getByRole('option', { name: 'Cubierta' })).toHaveAttribute('aria-selected', 'false');
});

test('choosing an option reports it and closes the list', () => {
  const { field, onChange } = setup();
  fireEvent.click(field);
  fireEvent.click(screen.getByRole('option', { name: 'Escalera' }));
  expect(onChange).toHaveBeenCalledWith('stairs');
  expect(screen.queryByRole('listbox')).toBeNull();
});

test('passing the mouse over it does not open it', () => {
  const { field } = setup();
  const root = field.closest('.desplegable')!;
  fireEvent.mouseEnter(root);
  expect(screen.queryByRole('listbox')).toBeNull();
  fireEvent.click(field);
  expect(screen.getByRole('listbox')).toBeInTheDocument();
  fireEvent.click(field); // a second click closes it
  expect(screen.queryByRole('listbox')).toBeNull();
});

test('the search box filters and says when nothing matches', () => {
  const { field } = setup();
  fireEvent.click(field);
  const search = screen.getByRole('searchbox');
  fireEvent.change(search, { target: { value: 'esc' } });
  expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Escalera']);
  fireEvent.change(search, { target: { value: 'zzz' } });
  expect(screen.queryAllByRole('option')).toHaveLength(0);
  expect(screen.getByText('Nada coincide con tu búsqueda')).toBeInTheDocument();
});

test('ignores accents and case when searching', () => {
  const { field } = setup();
  fireEvent.click(field);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'BALCON' } });
  expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Balcón']);
});

test('does not close on mouse leave while typing in the search box', () => {
  vi.useFakeTimers();
  const { field } = setup();
  const root = field.closest('.desplegable')!;
  fireEvent.click(field);
  const search = screen.getByRole('searchbox');
  search.focus();
  fireEvent.change(search, { target: { value: 'b' } });
  fireEvent.mouseLeave(root);
  act(() => void vi.advanceTimersByTime(1000));
  expect(screen.getByRole('listbox')).toBeInTheDocument();
});

test('works with the keyboard and closes with Esc', () => {
  const { field, onChange } = setup();
  fireEvent.keyDown(field, { key: 'ArrowDown' });
  const search = screen.getByRole('searchbox');
  fireEvent.keyDown(search, { key: 'ArrowDown' });
  fireEvent.keyDown(search, { key: 'Enter' });
  expect(onChange).toHaveBeenCalledWith('balcony');
  fireEvent.keyDown(field, { key: 'ArrowDown' });
  fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' });
  expect(screen.queryByRole('listbox')).toBeNull();
});

test('a click outside closes it', () => {
  const { field } = setup();
  fireEvent.click(field);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('listbox')).toBeNull();
});

test('offers no way to create options', () => {
  const { field } = setup();
  fireEvent.click(field);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Sótano' } });
  expect(screen.queryByText(/Crear/)).toBeNull();
});
