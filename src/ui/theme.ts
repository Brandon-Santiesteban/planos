import { create } from 'zustand';

export type Theme = 'claro' | 'oscuro';
const KEY = 'tema';

export function initialTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === 'claro' || stored === 'oscuro') return stored;
  return prefersDark ? 'oscuro' : 'claro';
}

/** Light tokens live on :root; dark ones on [data-tema="oscuro"]. */
export function applyTheme(t: Theme): void {
  if (t === 'oscuro') document.documentElement.dataset.tema = 'oscuro';
  else delete document.documentElement.dataset.tema;
}

function readStored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

const prefersDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

export const useTheme = create<{ theme: Theme; setTheme(t: Theme): void }>()((set) => ({
  theme: typeof document === 'undefined' ? 'claro' : initialTheme(readStored(), prefersDark()),
  setTheme(theme) {
    applyTheme(theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // private mode: the choice just isn't remembered
    }
    set({ theme });
  },
}));

/** Reads the current value of a CSS colour token (for three.js materials). */
export function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim() || '#888888';
}
