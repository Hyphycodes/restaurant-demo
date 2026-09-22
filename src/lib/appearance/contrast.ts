/**
 * Colour arithmetic for the appearance guardrails.
 *
 * WCAG contrast, an HSL round trip, and the two operations the dials need:
 * nudge a text colour's lightness until it passes against a surface, and
 * clamp an accent into the range where a label stays legible on it. Pure,
 * so the tests can pin every edge.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1]!, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(rgb: Rgb): number {
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return 1;
  const la = luminance(ra);
  const lb = luminance(rb);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

export function rgbToHsl({ r, g, b }: Rgb): [number, number, number] {
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

export function hslToRgb(h: number, s: number, l: number): Rgb {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return { r: f(h + 1 / 3) * 255, g: f(h) * 255, b: f(h - 1 / 3) * 255 };
}

export function isDark(hex: string): boolean {
  const rgb = hexToRgb(hex);
  return rgb ? luminance(rgb) < 0.18 : true;
}

/** Same hue and saturation, a different lightness. */
export function withLightness(hex: string, l: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const [h, s] = rgbToHsl(rgb);
  return rgbToHex(hslToRgb(h, s, Math.max(0, Math.min(1, l))));
}

export function mix(a: string, b: string, amount: number): string {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return a;
  return rgbToHex({ r: ra.r + (rb.r - ra.r) * amount, g: ra.g + (rb.g - ra.g) * amount, b: ra.b + (rb.b - ra.b) * amount });
}

/**
 * Move a text colour's lightness, away from the surface, until it clears the
 * target ratio. Returns the adjusted colour, or null when even the extreme
 * (pure light or dark of that hue) cannot pass.
 */
export function nudgeToContrast(text: string, surface: string, target: number): { hex: string; changed: boolean } | null {
  if (contrast(text, surface) >= target) return { hex: text, changed: false };
  const rgb = hexToRgb(text);
  if (!rgb) return null;
  const [h, s, l] = rgbToHsl(rgb);
  const darkSurface = isDark(surface);
  for (let step = 1; step <= 40; step += 1) {
    const next = darkSurface ? l + step * 0.02 : l - step * 0.02;
    if (next < 0 || next > 1) break;
    const candidate = rgbToHex(hslToRgb(h, s, next));
    if (contrast(candidate, surface) >= target) return { hex: candidate, changed: true };
  }
  const extreme = darkSurface ? '#ffffff' : '#000000';
  return contrast(extreme, surface) >= target ? { hex: extreme, changed: true } : null;
}

/**
 * Keep an accent where a button label stays readable: clamp lightness to
 * 0.32–0.72 and saturation to at most 0.9, then pick the label — near-black
 * or cream — that clears 4.5:1, preferring dark like the house style.
 */
export function clampAccent(hex: string): { accent: string; label: string; changed: boolean } | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [h, s, l] = rgbToHsl(rgb);
  const cl = Math.max(0.32, Math.min(0.72, l));
  const cs = Math.min(0.9, s);
  const accent = rgbToHex(hslToRgb(h, cs, cl));
  const dark = '#2a1203';
  const cream = '#f7eedc';
  if (contrast(dark, accent) >= 4.5) return { accent, label: dark, changed: accent.toLowerCase() !== hex.toLowerCase() };
  if (contrast(cream, accent) >= 4.5) return { accent, label: cream, changed: accent.toLowerCase() !== hex.toLowerCase() };
  // Lightness in range but neither label passes: push toward whichever end is closer.
  for (let step = 1; step <= 20; step += 1) {
    for (const direction of [1, -1]) {
      const candidate = rgbToHex(hslToRgb(h, cs, Math.max(0.32, Math.min(0.72, cl + direction * step * 0.02))));
      if (contrast(dark, candidate) >= 4.5) return { accent: candidate, label: dark, changed: true };
      if (contrast(cream, candidate) >= 4.5) return { accent: candidate, label: cream, changed: true };
    }
  }
  return null;
}
