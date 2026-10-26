import Icon, { type IconName } from './Icon';
import { notify, type Toast, useToasts } from './toasts';

const ICON: Record<Toast['kind'], IconName> = { ok: 'check', info: 'info', warn: 'alert', error: 'alert' };

async function copyError(t: Toast) {
  const text = t.detail ? `${t.text} — ${t.detail}` : t.text;
  useToasts.getState().dismiss(t.id);
  try {
    await navigator.clipboard.writeText(text);
    notify({ kind: 'ok', text: 'Error copiado al portapapeles' });
  } catch {
    notify({ kind: 'warn', text: 'No se pudo copiar el error' });
  }
}

/** Dark pill notifications, bottom centre, max 3. */
export default function ToastHost() {
  const toasts = useToasts((s) => s.toasts);
  const { dismiss, pause, resume } = useToasts.getState();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => {
        const isError = t.kind === 'error';
        return (
          <div
            key={t.id}
            className={`toast toast-${t.kind}`}
            role={isError ? 'button' : 'status'}
            tabIndex={isError ? 0 : undefined}
            title={isError ? 'Clic para copiar' : undefined}
            onMouseEnter={() => pause(t.id)}
            onMouseLeave={() => resume(t.id)}
            onClick={isError ? () => void copyError(t) : undefined}
            onKeyDown={isError ? (e) => { if (e.key === 'Enter') void copyError(t); } : undefined}
          >
            <Icon name={ICON[t.kind]} size={16} className="toast-icono" />
            <span className="toast-texto">{t.text}</span>
            {isError && <span className="toast-copiar">Clic para copiar</span>}
            {t.action && (
              <button
                className="toast-accion"
                onClick={(e) => {
                  e.stopPropagation();
                  t.action!.run();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button
              className="toast-cerrar"
              aria-label="Cerrar"
              onClick={(e) => {
                e.stopPropagation();
                dismiss(t.id);
              }}
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
