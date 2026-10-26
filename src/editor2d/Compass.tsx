/** North arrow drawn in screen space (not scaled by zoom), rotated by the project's north. */
export default function Compass({ north, x, y }: { north: number; x: number; y: number }) {
  return (
    <g className="brujula" data-testid="brujula" transform={`translate(${x} ${y})`}>
      <circle className="brujula-fondo" r={26} />
      <g className="aguja" transform={`rotate(${north})`}>
        <path className="aguja-norte" d="M0 -20 L6 0 L-6 0 Z" />
        <path className="aguja-sur" d="M0 20 L6 0 L-6 0 Z" />
        <text className="brujula-n" y={-29} textAnchor="middle">N</text>
      </g>
    </g>
  );
}
