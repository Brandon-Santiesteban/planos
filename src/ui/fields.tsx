import { useEffect, useId, useState } from 'react';
import { formatMetres, parseLength } from '../model/units';

/** Length input in metres: commits on Enter or blur, shows red and ignores invalid text. */
export function LengthField({ label, value, onCommit, allowEmpty = false, placeholder }: {
  label: string;
  value: number | null;
  onCommit: (v: number | null) => void;
  allowEmpty?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  const shown = value === null ? '' : formatMetres(value).replace(' m', '');
  const [text, setText] = useState(shown);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setText(shown);
    setInvalid(false);
  }, [shown]);

  const commit = () => {
    if (text === shown) {
      setInvalid(false); // untouched: never round the real value to the 2 decimals shown
      return;
    }
    if (text.trim() === '' && allowEmpty) {
      setInvalid(false);
      onCommit(null);
      return;
    }
    const v = parseLength(text);
    if (v === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onCommit(v);
    // If the edit was refused the value doesn't change; show the real value again.
    setText(shown);
  };

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="with-unit">
        <input
          id={id}
          className={invalid ? 'invalid' : ''}
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
        />
        <span className="unit">m</span>
      </div>
    </div>
  );
}

export function TextField({ label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => void }) {
  const id = useId();
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => {
    const t = text.trim();
    if (t && t !== value) onCommit(t);
    else setText(value);
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
      />
    </div>
  );
}
