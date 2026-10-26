import { useMemo } from 'react';
import { Color } from 'three';
import { token, useTheme } from '../ui/theme';

/** 3D colours read from the CSS tokens; recomputed when the light/dark mode changes. */
export function usePalette() {
  const theme = useTheme((s) => s.theme);
  return useMemo(
    () => ({
      wall: token('muro-3d'),
      floor: token('suelo-3d'),
      sky: token('fondo'),
      selected: token('acento'),
      room: token('sup2'),
      // `t3` softened towards the floor colour so the slab reads as stone, not paint.
      balcony: '#' + new Color(token('t3')).lerp(new Color(token('suelo-3d')), 0.65).getHexString(),
      rail: token('tenue'),
      line: token('linea'),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme],
  );
}
