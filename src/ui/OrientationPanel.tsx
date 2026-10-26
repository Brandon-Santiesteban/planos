import { useEffect, useState } from 'react';
import { setNorth } from '../model/ops';
import { frontFacing } from '../model/orientation';
import { useEditor } from '../store/editorStore';
import Icon from './Icon';

/** Where north is, and which way the front of the house (top of the plan) faces. */
export default function OrientationPanel() {
  const north = useEditor((s) => s.project.north);
  const [text, setText] = useState(String(north));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setText(String(north));
    setInvalid(false);
  }, [north]);

  const apply = (deg: number) => useEditor.getState().apply((d) => setNorth(d, deg));
  const commit = () => {
    if (text === String(north)) return;
    const v = Number(text.replace(',', '.'));
    if (text.trim() === '' || !Number.isFinite(v)) {
      setInvalid(true);
      return;
    }
    apply(v);
  };

  return (
    <div className="orientacion">
      <h3>Orientación</h3>
      <p className="hint">{`El frente (arriba del plano) mira al ${frontFacing(north)}.`}</p>
      <div className="field">
        <label htmlFor="norte">Norte (grados)</label>
        <div className="with-unit">
          <button className="btn btn-chico" aria-label="Girar el norte 15° a la izquierda" onClick={() => apply(north - 15)}>
            <Icon name="undo" size={16} />
          </button>
          <input
            id="norte"
            className={invalid ? 'invalid' : ''}
            value={text}
            inputMode="numeric"
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
          />
          <button className="btn btn-chico" aria-label="Girar el norte 15° a la derecha" onClick={() => apply(north + 15)}>
            <Icon name="redo" size={16} />
          </button>
        </div>
        {invalid
          ? <span className="error">Escribe un número de grados, por ejemplo 90.</span>
          : <span className="ayuda">0 = el norte queda hacia arriba del plano. Usa la brújula del celular parado frente a la casa.</span>}
      </div>
    </div>
  );
}
