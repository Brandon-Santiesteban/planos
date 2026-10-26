import Icon from '../ui/Icon';
import { useWalk } from './walkStore';

/** «Caminar» in the 3D view's bottom bar; while walking it becomes «Salir de caminar». */
export function WalkButton() {
  const walking = useWalk((s) => s.walking);
  const set = useWalk((s) => s.set);
  return walking ? (
    <button type="button" className="btn btn-chico" onClick={() => set({ walking: false })}>
      <Icon name="x" size={16} />Salir de caminar
    </button>
  ) : (
    <button type="button" className="btn btn-chico" onClick={() => set({ walking: true })}>
      <Icon name="walk" size={16} />Caminar
    </button>
  );
}

/** How to move, over the 3D view while walking (fainter once the mouse is captured). */
export function WalkHint() {
  const walking = useWalk((s) => s.walking);
  const looking = useWalk((s) => s.looking);
  if (!walking) return null;
  return (
    <div className={`ayuda-caminar${looking ? ' mirando' : ''}`} role="status">
      Clic para mirar · WASD para moverte · Shift para correr · Esc suelta el ratón
    </div>
  );
}
