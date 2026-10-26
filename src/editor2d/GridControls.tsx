import Icon from '../ui/Icon';
import SegmentedSwitch from '../ui/SegmentedSwitch';
import { type GridStep, useGrid } from './gridSettings';

const STEPS: { value: string; label: string }[] = [
  { value: '0.1', label: '10 cm' },
  { value: '0.5', label: '50 cm' },
  { value: '1', label: '1 m' },
];

/** Show/hide the plan grid and choose its size (also the snapping size). */
export default function GridControls() {
  const { visible, step, setVisible, setStep } = useGrid();
  return (
    <div className="controles-cuadricula">
      <button
        className={`btn btn-sec btn-cuadricula${visible ? ' activo' : ''}`}
        onClick={() => setVisible(!visible)}
        aria-pressed={visible}
        title={visible ? 'Ocultar la cuadrícula' : 'Mostrar la cuadrícula'}
      >
        <Icon name="grid" size={16} />Cuadrícula
      </button>
      {visible && (
        <SegmentedSwitch label="Tamaño de la cuadrícula" value={String(step)} options={STEPS} onChange={(v) => setStep(Number(v) as GridStep)} />
      )}
    </div>
  );
}
