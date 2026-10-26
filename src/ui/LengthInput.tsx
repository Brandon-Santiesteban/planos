/** Floating box that shows the length being typed while drawing. */
export default function LengthInput({ text, valid, x, y, label = 'Longitud' }: {
  text: string; valid: boolean; x: number; y: number; label?: string;
}) {
  return (
    <div className={`length-input${valid ? '' : ' invalid'}`} style={{ left: x + 16, top: y + 16 }}>
      <span className="label">{label}</span>
      <span className="value">{text}</span>
      <span className="unit">m · Enter</span>
    </div>
  );
}
