import { notify, useToasts } from './toasts';

const list = () => useToasts.getState().toasts;

beforeEach(() => {
  vi.useFakeTimers();
  useToasts.setState({ toasts: [] });
});
afterEach(() => vi.useRealTimers());

test('a success toast goes away after 5 s', () => {
  notify({ kind: 'ok', text: 'Guardado' });
  expect(list()).toHaveLength(1);
  vi.advanceTimersByTime(4900);
  expect(list()).toHaveLength(1);
  vi.advanceTimersByTime(200);
  expect(list()).toHaveLength(0);
});

test('error toasts stay until closed', () => {
  notify({ kind: 'error', text: 'No se pudo guardar' });
  vi.advanceTimersByTime(60_000);
  expect(list()).toHaveLength(1);
});

test('at most 3 toasts are shown, the oldest leaves first', () => {
  for (const t of ['a', 'b', 'c', 'd']) notify({ kind: 'info', text: t });
  expect(list().map((t) => t.text)).toEqual(['b', 'c', 'd']);
});

test('hovering pauses the timer', () => {
  const id = notify({ kind: 'ok', text: 'x' });
  vi.advanceTimersByTime(3000);
  useToasts.getState().pause(id);
  vi.advanceTimersByTime(10_000);
  expect(list()).toHaveLength(1);
  useToasts.getState().resume(id);
  vi.advanceTimersByTime(5100);
  expect(list()).toHaveLength(0);
});

test('dismiss removes a toast', () => {
  const id = notify({ kind: 'error', text: 'x' });
  useToasts.getState().dismiss(id);
  expect(list()).toHaveLength(0);
});
