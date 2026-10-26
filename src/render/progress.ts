const two = (n: number) => String(n).padStart(2, '0');

/** `m:ss`, or `h:mm:ss` from one hour on. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

export interface RenderProgress {
  done: number;
  fraction: number;
  finished: boolean;
  samplesText: string;
  timeText: string;
  remainingText: string;
}

/** Texts for the "Avisos de progreso" card. `samples` may be fractional (tiles of the current sample). */
export function describeProgress(samples: number, target: number, elapsedMs: number): RenderProgress {
  const finished = samples >= target;
  const clamped = Math.min(samples, target);
  const done = Math.floor(clamped);
  let remainingText = '';
  if (!finished) {
    remainingText = clamped >= 1 ? `Faltan unos ${formatDuration((elapsedMs / clamped) * (target - clamped))}` : 'Calculando…';
  }
  return {
    done,
    fraction: target > 0 ? clamped / target : 1,
    finished,
    samplesText: `${done} de ${target} muestras`,
    timeText: formatDuration(elapsedMs),
    remainingText,
  };
}
