import { describe, expect, it } from 'vitest';
import { describeProgress, formatDuration } from './progress';

describe('formatDuration', () => {
  it('shows m:ss under an hour and h:mm:ss above', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65_400)).toBe('1:05');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
  });
});

describe('describeProgress', () => {
  it('reports whole samples, the fraction and the time spent', () => {
    const p = describeProgress(31.6, 128, 42_000);
    expect(p.done).toBe(31);
    expect(p.fraction).toBeCloseTo(31.6 / 128);
    expect(p.samplesText).toBe('31 de 128 muestras');
    expect(p.timeText).toBe('0:42');
  });

  it('estimates the remaining time once some samples exist', () => {
    expect(describeProgress(32, 128, 40_000).remainingText).toBe('Faltan unos 2:00');
    expect(describeProgress(0, 128, 3_000).remainingText).toBe('Calculando…');
  });

  it('clamps at the target and says it is finished', () => {
    const p = describeProgress(130, 128, 90_000);
    expect(p.fraction).toBe(1);
    expect(p.finished).toBe(true);
    expect(p.samplesText).toBe('128 de 128 muestras');
    expect(p.remainingText).toBe('');
  });
});
