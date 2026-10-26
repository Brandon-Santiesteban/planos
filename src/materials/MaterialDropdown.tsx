import { useEffect, useId, useRef, useState } from 'react';
import Icon from '../ui/Icon';

export type DropdownOption<T extends string> = { value: T; label: string; chip?: string };

const CLOSE_DELAY_MS = 350;

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * The guide's single-choice dropdown (never the browser <select>): a filled field with the value and a turning arrow;
 * opens on hover, click or keyboard; closes 350 ms after the mouse leaves, on an outside click, with Esc or on choosing.
 * Self-contained for the material pickers (src/materials) so it doesn't collide with other dropdowns.
 */
export default function MaterialDropdown<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T | undefined;
  options: DropdownOption<T>[];
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const listId = useId();
  const chosen = options.find((o) => o.value === value);
  const shown = options.filter((o) => fold(o.label).includes(fold(query.trim())));

  const cancelClose = () => clearTimeout(closeTimer.current);
  const show = () => {
    cancelClose();
    if (!open) {
      setQuery('');
      setActive(Math.max(0, options.findIndex((o) => o.value === value)));
      setOpen(true);
    }
  };
  const hide = () => {
    cancelClose();
    setOpen(false);
  };
  const choose = (o: DropdownOption<T>) => {
    hide();
    if (o.value !== value) onChange(o.value);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) hide();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      hide();
      return;
    }
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      show();
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(shown.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && shown[active]) {
      e.preventDefault();
      choose(shown[active]);
    }
  };

  return (
    <div
      ref={root}
      className={`desplegable-mat${open ? ' abierto' : ''}`}
      onMouseEnter={show}
      onMouseLeave={() => {
        cancelClose();
        closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
      }}
      onKeyDown={onKey}
    >
      <button
        type="button"
        className="desplegable-mat-campo"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? hide() : show())}
      >
        {chosen?.chip && <span className="muestra-mat" style={{ background: chosen.chip }} aria-hidden="true" />}
        <span className="desplegable-mat-valor">{chosen?.label ?? 'Elige una opción'}</span>
        <svg className="flecha" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="desplegable-mat-panel">
          <input
            className="desplegable-mat-buscar"
            placeholder="Buscar"
            aria-label={`Buscar en ${label}`}
            value={query}
            autoFocus
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
          />
          <ul role="listbox" id={listId} aria-label={label}>
            {shown.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                className={i === active ? 'activa' : ''}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
              >
                <span className="check">{o.value === value && <Icon name="check" size={16} />}</span>
                {o.chip && <span className="muestra-mat" style={{ background: o.chip }} aria-hidden="true" />}
                {o.label}
              </li>
            ))}
          </ul>
          {shown.length === 0 && <p className="desplegable-mat-vacio">Nada coincide con tu búsqueda</p>}
        </div>
      )}
    </div>
  );
}
