import { useEffect, useId, useRef, useState } from 'react';
import Icon from './Icon';

const CLOSE_DELAY = 350;

/** Lower case without accents, so «balcon» finds «Balcón». */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * The guide's single-choice dropdown (never the browser `<select>`): opens on hover, click or keyboard; closes
 * 350 ms after the mouse leaves, on a click outside, with Esc or on choosing. Search box on top; no option creation.
 */
export default function Dropdown<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusSearch = useRef(false);

  const shown = options.filter((o) => fold(o.label).includes(fold(query.trim())));
  const current = options.find((o) => o.value === value);

  const cancelClose = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const show = (withFocus: boolean) => {
    cancelClose();
    if (!open) {
      setQuery('');
      setActive(Math.max(0, options.findIndex((o) => o.value === value)));
      setOpen(true);
    }
    focusSearch.current = withFocus;
    if (withFocus) searchRef.current?.focus();
  };
  const close = (refocus = false) => {
    cancelClose();
    setOpen(false);
    if (refocus) fieldRef.current?.focus();
  };
  const choose = (v: T) => {
    if (v !== value) onChange(v);
    close(document.activeElement === searchRef.current);
  };

  useEffect(() => {
    if (open && focusSearch.current) searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  useEffect(() => cancelClose, []);

  const onLeave = () => {
    if (!open) return;
    cancelClose();
    timer.current = setTimeout(() => {
      // Never close under someone typing a search.
      if (document.activeElement !== searchRef.current) setOpen(false);
    }, CLOSE_DELAY);
  };

  const onFieldKey = (e: React.KeyboardEvent) => {
    // Enter and Space reach onClick as the button's own click.
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      show(true);
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation();
      close();
    }
  };

  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(shown.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = shown[active];
      if (o) choose(o.value);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      close(true);
    }
  };

  return (
    <div className={`desplegable${open ? ' abierta' : ''}`} ref={rootRef} onMouseEnter={() => show(false)} onMouseLeave={onLeave}>
      <button
        ref={fieldRef}
        type="button"
        className="desplegable-campo"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-lista`}
        // Opened by hover, a click moves into the search; opened by click, it closes.
        onClick={() => (open && focusSearch.current ? close() : show(true))}
        onKeyDown={onFieldKey}
      >
        <span className="desplegable-valor">{current?.label ?? ''}</span>
        <Icon name="chevron" size={16} className="desplegable-flecha" />
      </button>
      {open && (
        <div className="desplegable-panel">
          <input
            ref={searchRef}
            type="search"
            className="desplegable-buscar"
            placeholder="Buscar…"
            aria-label={`Buscar en ${label}`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onSearchKey}
          />
          <ul id={`${id}-lista`} role="listbox" aria-label={label}>
            {shown.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                className={i === active ? 'activa' : ''}
                onMouseMove={() => setActive(i)}
                onClick={() => choose(o.value)}
              >
                <span className="desplegable-check">{o.value === value && <Icon name="check" size={16} />}</span>
                {o.label}
              </li>
            ))}
          </ul>
          {shown.length === 0 && <p className="desplegable-vacio">Nada coincide con tu búsqueda</p>}
        </div>
      )}
    </div>
  );
}
