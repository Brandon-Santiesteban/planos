// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import SegmentedSwitch from './SegmentedSwitch';

test('marks the active option and reports changes', () => {
  const onChange = vi.fn();
  render(
    <SegmentedSwitch
      label="Tipo"
      value="room"
      options={[{ value: 'room', label: 'Habitación' }, { value: 'balcony', label: 'Balcón' }]}
      onChange={onChange}
    />,
  );
  expect(screen.getByRole('radio', { name: 'Habitación' })).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(screen.getByRole('radio', { name: 'Balcón' }));
  expect(onChange).toHaveBeenCalledWith('balcony');
  expect(screen.getByRole('radiogroup', { name: 'Tipo' })).toBeInTheDocument();
});
