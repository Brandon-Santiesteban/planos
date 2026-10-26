import { beforeEach, describe, expect, it } from 'vitest';
import { useRender } from './renderStore';

describe('render store', () => {
  beforeEach(() => useRender.setState({ open: false, preset: 'bueno', ctx: null }));

  it('opens and closes the render window', () => {
    useRender.getState().openWindow();
    expect(useRender.getState().open).toBe(true);
    useRender.getState().closeWindow();
    expect(useRender.getState().open).toBe(false);
  });

  it('remembers the chosen quality', () => {
    useRender.getState().setPreset('alto');
    expect(useRender.getState().preset).toBe('alto');
  });
});
