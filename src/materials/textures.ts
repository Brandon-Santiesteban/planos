// Procedural textures drawn on a canvas (no downloads). Each one covers the real-world tile of its catalog
// entry (catalog.ts) and tiles seamlessly; the library repeats it by metres.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import type { FloorMaterial, WallFinish } from '../model/types';
import { FLOOR_MATERIALS, WALL_FINISHES } from './catalog';

type Ctx = CanvasRenderingContext2D;
/** Draws in metres on a canvas whose size matches the tile; `wrap` repeats a shape across the edges. */
type Painter = (g: Ctx, W: number, H: number, rnd: () => number, wrap: (draw: () => void) => void) => void;

/** Small seeded generator (mulberry32) so textures look the same every time. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(rnd: () => number, xs: T[]) => xs[Math.floor(rnd() * xs.length)];

/** Fine grain: many faint dots in lighter and darker tones. */
function speckle(g: Ctx, W: number, H: number, rnd: () => number, count: number, alpha: number, dot: number) {
  for (let i = 0; i < count; i++) {
    g.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${alpha * rnd()})` : `rgba(255,255,255,${alpha * rnd()})`;
    g.fillRect(rnd() * W, rnd() * H, dot, dot);
  }
}

function tiles(g: Ctx, W: number, H: number, rnd: () => number, cols: number, rows: number, grout: string, joint: number, tones: string[], mottle: number) {
  g.fillStyle = grout;
  g.fillRect(0, 0, W, H);
  const tw = W / cols;
  const th = H / rows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      g.fillStyle = pick(rnd, tones);
      g.fillRect(i * tw + joint / 2, j * th + joint / 2, tw - joint, th - joint);
    }
  }
  speckle(g, W, H, rnd, mottle, 0.06, W / 300);
}

function stones(g: Ctx, W: number, H: number, rnd: () => number, wrap: (d: () => void) => void, mortar: string, tones: string[], n: number) {
  g.fillStyle = mortar;
  g.fillRect(0, 0, W, H);
  const cw = W / n;
  const ch = H / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const cx = (i + 0.5 + (rnd() - 0.5) * 0.25) * cw;
      const cy = (j + 0.5 + (rnd() - 0.5) * 0.25) * ch;
      const k = 6 + Math.floor(rnd() * 3);
      const pts = Array.from({ length: k }, (_, m) => {
        const a = (m / k) * Math.PI * 2 + rnd() * 0.4;
        const r = 0.5 + rnd() * 0.12;
        return [cx + Math.cos(a) * cw * r, cy + Math.sin(a) * ch * r] as const;
      });
      const tone = pick(rnd, tones);
      wrap(() => {
        g.fillStyle = tone;
        g.beginPath();
        pts.forEach(([x, y], m) => (m ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
        g.fill();
      });
    }
  }
  speckle(g, W, H, rnd, 2500, 0.12, W / 250);
}

const WALL: Record<Exclude<WallFinish, 'pintura'>, Painter> = {
  ladrillo: (g, W, H, rnd, wrap) => {
    g.fillStyle = '#C8BFB2';
    g.fillRect(0, 0, W, H);
    const tones = ['#A4553A', '#9A4C33', '#AD5E40', '#94472F', '#B0644A', '#8F4A35'];
    for (let row = 0; row < 6; row++) {
      const y = row * 0.08 + 0.005;
      const shift = row % 2 ? 0.125 : 0;
      for (let b = 0; b < 4; b++) {
        const x = shift + b * 0.25 + 0.005;
        const tone = pick(rnd, tones);
        wrap(() => {
          g.fillStyle = tone;
          g.fillRect(x, y, 0.24, 0.07);
        });
      }
    }
    speckle(g, W, H, rnd, 3000, 0.18, 0.003);
  },
  piedra: (g, W, H, rnd, wrap) => stones(g, W, H, rnd, wrap, '#857D72', ['#A39A8C', '#958C7F', '#B1A897', '#8C8478', '#A69C8A'], 4),
  madera: (g, _W, H, rnd) => {
    const tones = ['#9A6B43', '#8E6039', '#A6774D', '#93653F', '#A0703F'];
    const bw = 0.12;
    for (let i = 0; i < 5; i++) {
      const x = i * bw;
      g.fillStyle = pick(rnd, tones);
      g.fillRect(x, 0, bw, H);
      // Grain: wavy vertical lines, periodic in height so the tile repeats.
      for (let l = 0; l < 7; l++) {
        const gx = x + 0.01 + rnd() * (bw - 0.02);
        const amp = 0.002 + rnd() * 0.004;
        const waves = 1 + Math.floor(rnd() * 3);
        g.strokeStyle = `rgba(60,35,15,${0.12 + rnd() * 0.15})`;
        g.lineWidth = 0.0015 + rnd() * 0.002;
        g.beginPath();
        for (let s = 0; s <= 40; s++) {
          const yy = (s / 40) * H;
          const xx = gx + Math.sin((yy / H) * Math.PI * 2 * waves) * amp;
          if (s) g.lineTo(xx, yy);
          else g.moveTo(xx, yy);
        }
        g.stroke();
      }
      g.fillStyle = 'rgba(40,22,10,0.55)';
      g.fillRect(x, 0, 0.003, H);
      const joint = rnd() * H;
      g.fillRect(x, joint, bw, 0.003);
    }
  },
  enchape: (g, W, H, rnd) => tiles(g, W, H, rnd, 2, 2, '#C9CDD1', 0.004, ['#E8EBEE', '#E3E6EA', '#ECEEF0'], 800),
};

const FLOOR: Record<FloorMaterial, Painter> = {
  ceramica: (g, W, H, rnd) => tiles(g, W, H, rnd, 2, 2, '#B9AE9F', 0.004, ['#D9CFC1', '#D4C9BA', '#DDD3C6'], 5000),
  // Matte 60 × 60 cm tiles: almost uniform with a soft mottle and thin joints.
  porcelanato: (g, W, H, rnd) => tiles(g, W, H, rnd, 2, 2, '#BDB7AD', 0.0025, ['#E2DDD4', '#E1DCD3'], 6000),
  madera: (g, W, _H, rnd, wrap) => {
    const tones = ['#A87A4F', '#9C6E45', '#B38459', '#A0734A', '#AE7F51'];
    const ph = 0.15;
    for (let r = 0; r < 6; r++) {
      const y = r * ph;
      // Two 60 cm planks per row, the joints staggered at random along the tile.
      const x0 = rnd() * W;
      const tone = pick(rnd, tones);
      const tone2 = pick(rnd, tones);
      wrap(() => {
        g.fillStyle = tone;
        g.fillRect(x0, y, W / 2, ph);
        g.fillStyle = tone2;
        g.fillRect(x0 + W / 2, y, W / 2, ph);
        g.fillStyle = 'rgba(40,22,10,0.5)';
        g.fillRect(x0, y, 0.003, ph);
        g.fillRect(x0 + W / 2, y, 0.003, ph);
      });
      for (let l = 0; l < 9; l++) {
        const gy = y + 0.01 + rnd() * (ph - 0.02);
        const waves = 1 + Math.floor(rnd() * 3);
        const amp = 0.002 + rnd() * 0.004;
        g.strokeStyle = `rgba(60,35,15,${0.1 + rnd() * 0.15})`;
        g.lineWidth = 0.0015 + rnd() * 0.002;
        g.beginPath();
        for (let s = 0; s <= 40; s++) {
          const xx = (s / 40) * W;
          const yy = gy + Math.sin((xx / W) * Math.PI * 2 * waves) * amp;
          if (s) g.lineTo(xx, yy);
          else g.moveTo(xx, yy);
        }
        g.stroke();
      }
      g.fillStyle = 'rgba(40,22,10,0.5)';
      g.fillRect(0, y, W, 0.003);
    }
  },
  concreto: (g, W, H, rnd, wrap) => {
    g.fillStyle = '#A9A8A3';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const r = 0.1 + rnd() * 0.35;
      const dark = rnd() < 0.5;
      const a = 0.04 + rnd() * 0.05;
      wrap(() => {
        const grad = g.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, dark ? `rgba(70,70,65,${a})` : `rgba(255,255,250,${a})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad;
        g.fillRect(x - r, y - r, 2 * r, 2 * r);
      });
    }
    speckle(g, W, H, rnd, 9000, 0.2, 0.004);
  },
  piedra: (g, W, H, rnd, wrap) => stones(g, W, H, rnd, wrap, '#7E776C', ['#A39A8C', '#B3AA99', '#978E80', '#ABA190', '#8F877A'], 3),
  cesped: (g, W, H, rnd) => {
    g.fillStyle = '#6E8A58';
    g.fillRect(0, 0, W, H);
    const tones = ['#66824F', '#768F60', '#627C4C', '#7A9364'];
    for (let i = 0; i < 6000; i++) {
      g.fillStyle = tones[i % tones.length];
      g.fillRect(rnd() * W, rnd() * H, 0.004, 0.01 + rnd() * 0.012);
    }
  },
};

const PX_LONG_SIDE = 512;

function paint(tile: [number, number], painter: Painter, seed: number): CanvasTexture {
  const [W, H] = tile;
  const ppm = PX_LONG_SIDE / Math.max(W, H);
  const c = document.createElement('canvas');
  c.width = Math.round(W * ppm);
  c.height = Math.round(H * ppm);
  const g = c.getContext('2d')!;
  g.scale(c.width / W, c.height / H);
  const wrap = (draw: () => void) => {
    for (const dx of [-W, 0, W]) {
      for (const dy of [-H, 0, H]) {
        g.save();
        g.translate(dx, dy);
        draw();
        g.restore();
      }
    }
  };
  painter(g, W, H, rng(seed), wrap);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  // UVs are in metres: one repeat per tile.
  t.repeat.set(1 / W, 1 / H);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function makeWallTexture(finish: Exclude<WallFinish, 'pintura'>): CanvasTexture {
  return paint(WALL_FINISHES[finish].tile, WALL[finish], finish.length * 97 + 11);
}

export function makeFloorTexture(m: FloorMaterial): CanvasTexture {
  return paint(FLOOR_MATERIALS[m].tile, FLOOR[m], m.length * 131 + 7);
}
