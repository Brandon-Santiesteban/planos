// Stroke icons (1.8px, round caps) drawn on a 24×24 grid.
const PATHS = {
  select: 'M5 3l13 8.5-5.6 1.4L9.6 19z',
  wall: 'M3 9h18v6H3z M9 9v6 M15 9v6',
  door: 'M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17 M3 21h18 M14 12.5v.01',
  window: 'M4 4h16v16H4z M12 4v16 M4 12h16',
  room: 'M4 4h16v16H4z M4 14h6v6',
  undo: 'M9 14L4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5 M20 9H10a6 6 0 0 0 0 12h3',
  save: 'M5 3h11l3 3v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z M8 3v5h7V3 M8 21v-7h8v7',
  open: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  new: 'M6 3h8l5 5v13H6z M14 3v5h5 M12.5 12v6 M9.5 15h6',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  magnet: 'M6 4v7a6 6 0 0 0 12 0V4 M6 8h4 M14 8h4 M10 4v7a2 2 0 0 0 4 0V4',
  trash: 'M4 7h16 M10 11v6 M14 11v6 M6 7l1 13h10l1-13 M9 7V4h6v3',
  maximize: 'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5',
  split: 'M4 4h16v16H4z M12 4v16',
  image: 'M4 4h16v16H4z M4 16l5-5 4 4 2-2 5 5 M15.5 8.5v.01',
  ruler: 'M3 17L17 3l4 4L7 21z M7 13l2 2 M10 10l2 2 M13 7l2 2',
  move: 'M12 3v18 M3 12h18 M9 6l3-3 3 3 M9 18l3 3 3-3 M6 9l-3 3 3 3 M18 9l3 3-3 3',
  plus: 'M12 5v14 M5 12h14',
  up: 'M12 19V5 M6 11l6-6 6 6',
  down: 'M12 5v14 M6 13l6 6 6-6',
  x: 'M6 6l12 12 M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 11v5 M12 7.5v.01',
  alert: 'M12 3l9.5 17h-19z M12 10v4 M12 17v.01',
  layers: 'M12 3l9 5-9 5-9-5z M3 13l9 5 9-5',
  quickRoom: 'M4 4h16v16H4z M12 8.5v7 M8.5 12h7',
  rotate: 'M20 12a8 8 0 1 1-2.34-5.66 M20 4v4h-4',
  grid: 'M4 4h16v16H4z M4 9.33h16 M4 14.67h16 M9.33 4v16 M14.67 4v16',
  copy: 'M9 9h11v11H9z M5 15V4h11',
  download: 'M12 4v11 M7 10l5 5 5-5 M5 20h14',
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={`icono${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
