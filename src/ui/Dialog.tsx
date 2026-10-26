import { useEffect } from 'react';
import { create } from 'zustand';

interface ConfirmOptions {
  title: string;
  text: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
}

const useDialog = create<{ current: (ConfirmOptions & { resolve(v: boolean): void }) | null }>()(() => ({ current: null }));

/** Centred confirmation window. Resolves true when the main button is pressed. */
export function askConfirm(opts: ConfirmOptions): Promise<boolean> {
  useDialog.getState().current?.resolve(false);
  return new Promise((resolve) => useDialog.setState({ current: { ...opts, resolve } }));
}

function close(value: boolean) {
  const c = useDialog.getState().current;
  useDialog.setState({ current: null });
  c?.resolve(value);
}

export function DialogHost() {
  const d = useDialog((s) => s.current);

  useEffect(() => {
    if (!d) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
      else if (e.key === 'Enter' && !d.danger) close(true);
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [d]);

  if (!d) return null;
  return (
    <div className="velo" onMouseDown={(e) => { if (e.target === e.currentTarget) close(false); }}>
      <div className="ventana ventana-confirmar" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
        <h2 id="dlg-title">{d.title}</h2>
        <p className="parrafo">{d.text}</p>
        <div className="ventana-botones">
          <button className="btn btn-sec" onClick={() => close(false)}>{d.cancelLabel ?? 'Cancelar'}</button>
          <button className={`btn ${d.danger ? 'btn-peligro' : 'btn-pri'}`} onClick={() => close(true)} autoFocus>
            {d.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
