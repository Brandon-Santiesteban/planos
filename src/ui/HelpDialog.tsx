import { useEffect } from 'react';
import { create } from 'zustand';
import Icon from './Icon';

const SEEN_KEY = 'ayuda-vista-v1';

function seen(): boolean {
  try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
}

/** Opens by itself on a viewer's first visit; «Ayuda» in the top bar opens it again. */
export const useHelp = create<{ open: boolean }>()(() => ({ open: import.meta.env.MODE !== 'e2e' && import.meta.env.MODE !== 'test' && !seen() }));

export function openHelp() { useHelp.setState({ open: true }); }

function closeHelp() {
  useHelp.setState({ open: false });
  try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* private window: it just shows again next time */ }
}

const SECTIONS: { color: string; icon: Parameters<typeof Icon>[0]['name']; title: string; rows: [string, string][] }[] = [
  {
    color: '#1E6FD9', icon: 'layers', title: 'Mirar la casa en 3D',
    rows: [
      ['Clic izquierdo y arrastrar', 'Girar alrededor de la casa'],
      ['Clic derecho y arrastrar', 'Mover la vista'],
      ['Rueda del ratón', 'Acercar y alejar'],
      ['«Ampliar»', 'Ver el 3D en pantalla completa'],
    ],
  },
  {
    color: '#1E7A46', icon: 'walk', title: 'Caminar por dentro',
    rows: [
      ['Botón «Caminar»', 'Entrar a la casa como una persona'],
      ['Clic en la vista', 'Mirar con el ratón'],
      ['W A S D o flechas', 'Avanzar, retroceder y a los lados'],
      ['Shift', 'Correr'],
      ['Esc', 'Soltar el ratón'],
    ],
  },
  {
    color: '#C47A12', icon: 'sun', title: 'Ambiente',
    rows: [
      ['Mañana · Tarde · Noche', 'Cambiar la hora del día'],
      ['«Plantas superiores»', 'Mostrar u ocultar los pisos de arriba'],
      ['«Luces» y «Cerrar puertas»', 'Encender luces y abrir o cerrar puertas'],
      ['Sol / luna arriba a la derecha', 'Modo claro u oscuro'],
    ],
  },
  {
    color: '#7A3FB8', icon: 'edit', title: 'Plano 2D',
    rows: [
      ['Clic en algo', 'Seleccionarlo y ver sus medidas a la derecha'],
      ['Rueda del ratón', 'Acercar y alejar'],
      ['Espacio + arrastrar', 'Mover el plano'],
      ['Ctrl + Z', 'Deshacer cualquier cambio'],
    ],
  },
];

export function HelpDialog() {
  const open = useHelp((s) => s.open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'Enter') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      closeHelp();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  if (!open) return null;
  return (
    <div className="velo" onMouseDown={(e) => { if (e.target === e.currentTarget) closeHelp(); }}>
      <div className="ventana ventana-ayuda" role="dialog" aria-modal="true" aria-labelledby="ayuda-titulo">
        <h2 id="ayuda-titulo">Cómo usar la página</h2>
        <p className="parrafo">A la izquierda está el plano; a la derecha, la casa en 3D.</p>
        <div className="ayuda-grupos">
          {SECTIONS.map((s) => (
            <section key={s.title} className="ayuda-grupo" style={{ ['--color-grupo' as string]: s.color }}>
              <h3><span className="ayuda-icono"><Icon name={s.icon} size={16} /></span>{s.title}</h3>
              <dl>
                {s.rows.map(([k, v]) => (
                  <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <div className="ventana-botones">
          <button className="btn btn-pri" onClick={closeHelp} autoFocus>Entendido</button>
        </div>
      </div>
    </div>
  );
}
