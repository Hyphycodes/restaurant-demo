import 'server-only';
import { DEMO_MODE } from '@/lib/demo';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * The surface a flyer sits on, tinted from the flyer itself.
 *
 * A white flyer on a near-black page reads as a hole; a flyer on a field
 * pulled from its own dominant colour reads as the poster on a wall. The
 * colour is darkened toward the page so cream type beside it stays AA.
 *
 * Cheap and forgiving: a 24px thumbnail through sharp, memoised per path for
 * the life of the process, and any failure — a missing file, a slow host, no
 * sharp — falls back to the event's own preset surface. Nothing here can
 * delay or break a render.
 */

const memo = new Map<string, Promise<string | null>>();
const TIMEOUT_MS = 1500;

export async function flyerTint(flyerPath: string | null, fallback: string): Promise<string> {
  if (!flyerPath) return fallback;
  let pending = memo.get(flyerPath);
  if (!pending) {
    pending = compute(flyerPath).catch(() => null);
    memo.set(flyerPath, pending);
  }
  const tint = await Promise.race([
    pending,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
  ]);
  return tint ?? fallback;
}

async function bytesOf(flyerPath: string): Promise<Buffer> {
  if (flyerPath.startsWith('/')) {
    return readFile(path.join(process.cwd(), 'public', flyerPath));
  }
  if(DEMO_MODE) throw new Error('External artwork fetch disabled.');
  const response = await fetch(flyerPath, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'force-cache' });
  if (!response.ok) throw new Error(`flyer ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function compute(flyerPath: string): Promise<string> {
  const { default: sharp } = await import('sharp');
  const bytes = await bytesOf(flyerPath);
  const { dominant } = await sharp(bytes).resize(24, 24, { fit: 'inside' }).stats();
  return deepen(dominant.r, dominant.g, dominant.b);
}

/**
 * Pull a colour down to a surface: keep its hue, cap its lightness so cream
 * text beside it clears 4.5:1, and keep a little chroma so it still reads as
 * the flyer's colour rather than as grey.
 */
export function deepen(r: number, g: number, b: number): string {
  const [h, s] = rgbToHsl(r, g, b);
  const lightness = 0.16;
  const saturation = Math.min(0.55, Math.max(0.18, s));
  const [nr, ng, nb] = hslToRgb(h, saturation, lightness);
  return `#${[nr, ng, nb].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [
    Math.round(channel(h + 1 / 3) * 255),
    Math.round(channel(h) * 255),
    Math.round(channel(h - 1 / 3) * 255),
  ];
}
