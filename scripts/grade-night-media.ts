/**
 * The after-dark grade.
 *
 * The licensed photography was shot in daylight and bright studio light. The
 * Cosa Nostra world is candlelit, so the public site uses graded derivatives:
 * lower exposure, warmer mids, crushed-but-not-black shadows, a heavy
 * vignette and a pool of candle light where the eye should land.
 *
 * Deterministic and repeatable — re-run after replacing any source photo:
 *
 *   npx tsx scripts/grade-night-media.ts
 *
 * Output: public/media/night/*.webp (registered in src/content/assets.ts).
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'public/media');
const OUT = path.join(ROOT, 'public/media/night');

interface Grade {
  out: string;
  src: string;
  /** Optional crop from the source, in source pixels. */
  extract?: { left: number; top: number; width: number; height: number };
  resize?: { width: number; height: number };
  brightness: number;
  saturation: number;
  /** Where the candle glow sits, 0–1 of the frame. */
  glow?: { x: number; y: number; r: number; strength: number };
  /** Vignette strength 0–1. */
  vignette: number;
  /** Warm (amber) multiply in the midtones, 0–1. */
  warmth: number;
  /** Paper grade keeps highlights cream instead of darkening them. */
  paper?: boolean;
  /** Pulls the top of the frame down — daylight windows become night glass. */
  topShade?: number;
}

const GRADES: Grade[] = [
  { topShade: 0.75, out: 'room-night', src: 'heroImage.webp', brightness: 0.58, saturation: 0.7, warmth: 0.55, vignette: 0.85, glow: { x: 0.52, y: 0.72, r: 0.34, strength: 0.55 } },
  { topShade: 0.75, out: 'room-night-tall', src: 'heroImage.webp', extract: { left: 560, top: 0, width: 960, height: 1200 }, resize: { width: 960, height: 1200 }, brightness: 0.56, saturation: 0.7, warmth: 0.6, vignette: 0.8, glow: { x: 0.45, y: 0.74, r: 0.42, strength: 0.6 } },
  { out: 'bar-night', src: 'bartender.webp', brightness: 0.78, saturation: 0.82, warmth: 0.5, vignette: 0.75, glow: { x: 0.45, y: 0.35, r: 0.4, strength: 0.4 } },
  { out: 'pasta-night', src: 'signaturePasta.webp', brightness: 0.8, saturation: 0.95, warmth: 0.35, vignette: 0.9, glow: { x: 0.52, y: 0.4, r: 0.38, strength: 0.35 } },
  { out: 'burrata-night', src: 'burrataPlate.webp', brightness: 0.72, saturation: 0.78, warmth: 0.45, vignette: 0.95, glow: { x: 0.5, y: 0.45, r: 0.35, strength: 0.3 } },
  { out: 'negroni-paper', src: 'houseNegroni.webp', brightness: 0.96, saturation: 0.9, warmth: 0.3, vignette: 0.35, paper: true },
  { topShade: 0.75, out: 'room-detail', src: 'heroImage.webp', extract: { left: 700, top: 560, width: 800, height: 600 }, resize: { width: 1200, height: 900 }, brightness: 0.62, saturation: 0.65, warmth: 0.65, vignette: 0.9, glow: { x: 0.45, y: 0.55, r: 0.4, strength: 0.6 } },
];

function vignetteSvg(width: number, height: number, strength: number, paper: boolean): Buffer {
  const edge = paper ? `rgba(92,58,30,${strength})` : `rgba(8,4,2,${strength})`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><radialGradient id="v" cx="50%" cy="48%" r="75%">
      <stop offset="0.35" stop-color="rgba(0,0,0,0)"/>
      <stop offset="1" stop-color="${edge}"/>
    </radialGradient></defs>
    <rect width="100%" height="100%" fill="url(#v)"/></svg>`);
}

function shadeSvg(width: number, height: number, strength: number): Buffer {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="rgba(6,3,2,${strength})"/>
      <stop offset="0.5" stop-color="rgba(6,3,2,${strength * 0.25})"/>
      <stop offset="1" stop-color="rgba(0,0,0,0)"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#s)"/></svg>`);
}

function glowSvg(width: number, height: number, g: NonNullable<Grade['glow']>): Buffer {
  const r = Math.round(Math.max(width, height) * g.r);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><radialGradient id="g" cx="${g.x * width}" cy="${g.y * height}" r="${r}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="rgba(255,176,92,${g.strength})"/>
      <stop offset="0.45" stop-color="rgba(214,120,52,${g.strength * 0.35})"/>
      <stop offset="1" stop-color="rgba(0,0,0,0)"/>
    </radialGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/></svg>`);
}

async function grade(g: Grade) {
  let img = sharp(path.join(SRC, g.src));
  if (g.extract) img = img.extract(g.extract);
  if (g.resize) img = img.resize(g.resize.width, g.resize.height, { fit: 'cover' });
  const base = await img.toBuffer({ resolveWithObject: true });
  const { width, height } = base.info;

  // Warm the mids: pull blue down, push red up a little, then lower exposure.
  const w = g.warmth;
  const graded = sharp(base.data)
    .recomb([
      [1 + 0.12 * w, 0.06 * w, 0],
      [0.02 * w, 1 - 0.02 * w, 0],
      [0, 0.02 * w, 1 - 0.28 * w],
    ])
    .modulate({ brightness: g.brightness, saturation: g.saturation })
    .gamma(g.paper ? 1.0 : 1.12);

  const layers: OverlayOptions[] = [
    { input: vignetteSvg(width, height, g.vignette, Boolean(g.paper)), blend: 'multiply' },
  ];
  if (g.topShade) layers.push({ input: shadeSvg(width, height, g.topShade), blend: 'multiply' });
  if (g.glow) layers.push({ input: glowSvg(width, height, g.glow), blend: 'screen' });

  await sharp(await graded.toBuffer())
    .composite(layers)
    .webp({ quality: 80, effort: 6 })
    .toFile(path.join(OUT, `${g.out}.webp`));
  console.log(`graded ${g.out}.webp ${width}x${height}`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  for (const g of GRADES) await grade(g);
}

void main();
