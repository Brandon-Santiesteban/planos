import type { Background } from '../../model/types';

export default function BackgroundLayer({ bg }: { bg: Background | null }) {
  if (!bg) return null;
  return (
    <image
      className="background"
      href={bg.dataUrl}
      x={bg.origin.x}
      y={bg.origin.y}
      width={bg.widthPx * bg.metresPerPixel}
      height={bg.heightPx * bg.metresPerPixel}
      opacity={bg.opacity}
      preserveAspectRatio="none"
    />
  );
}
