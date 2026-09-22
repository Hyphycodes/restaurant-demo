import { clampAccent, contrast, isDark, mix, nudgeToContrast, withLightness } from './contrast';

/**
 * The four looks, and how a saved appearance becomes CSS custom properties.
 *
 * A preset is a complete token set for the public site's palette — the same
 * variables globals.css declares — named for a feeling rather than a colour.
 * The two dials (background, accent) override the preset's surface and accent
 * and every derived token follows, with the guardrails in contrast.ts making
 * sure no combination can put text below AA.
 */

export const PRESETS = ['evening', 'aperitivo', 'nocturne', 'daylight'] as const;
export type PresetName = (typeof PRESETS)[number];

export const SEASONS = ['none', 'halloween', 'nocturne', 'winter', 'spring'] as const;
export type Season = (typeof SEASONS)[number];

export type Intensity = 'subtle' | 'lively';

export interface Appearance {
  preset: PresetName;
  surfaceHex: string | null;
  accentHex: string | null;
  season: Season;
  decorationsEnabled: boolean;
  decorationIntensity: Intensity;
  adminFollowsSite: boolean;
}

export const DEFAULT_APPEARANCE: Appearance = {
  preset: 'daylight',
  surfaceHex: '#f2ebdf',
  accentHex: '#713239',
  season: 'none',
  decorationsEnabled: true,
  decorationIntensity: 'subtle',
  adminFollowsSite: false,
};

/** The six roles a preset is built from. Everything else derives. */
export interface PresetTokens {
  surface: string;
  raised: string;
  accent: string;
  text: string;
  muted: string;
  hairline: string;
}

export interface PresetDefinition {
  name: PresetName;
  label: string;
  hint: string;
  tokens: PresetTokens;
  /** Swatches offered on the dials. */
  surfaces: string[];
  accents: string[];
}

export const PRESET_DEFINITIONS: Record<PresetName, PresetDefinition> = {
  evening: {
    name: 'evening',
    label: 'Evening',
    hint: 'Deep warm dark, cream type, one amber accent. The house style.',
    tokens: { surface: '#1a1008', raised: '#241708', accent: '#e8a33d', text: '#f7eedc', muted: '#c4ac8c', hairline: 'rgb(247 238 220 / 0.14)' },
    surfaces: ['#1a1008', '#120b06', '#1c1410', '#0f2e2c', '#2e1620'],
    accents: ['#e8a33d', '#f5bd5f', '#e1553a', '#f08a6e', '#86a98c'],
  },
  aperitivo: {
    name: 'aperitivo',
    label: 'Aperitivo',
    hint: 'Warmer and louder: a saturated coral accent for summer and party nights.',
    tokens: { surface: '#1f0e0a', raised: '#2c140d', accent: '#ff6a3d', text: '#fff1e0', muted: '#d9b59a', hairline: 'rgb(255 241 224 / 0.16)' },
    surfaces: ['#1f0e0a', '#2a0f0f', '#12161f', '#1a1008', '#0f2e2c'],
    accents: ['#ff6a3d', '#ffb347', '#ff4f8b', '#7fe3e0', '#e8a33d'],
  },
  nocturne: {
    name: 'nocturne',
    label: 'Autumn evenings',
    hint: 'Deep plum and brass. Pairs with the editorial ribbons and the petals.',
    tokens: { surface: '#1d101d', raised: '#2d1829', accent: '#f0b24a', text: '#f4e7cf', muted: '#cfb58f', hairline: 'rgb(244 231 207 / 0.16)' },
    surfaces: ['#1d101d', '#120a12', '#22121f', '#3b1526', '#1a1008'],
    accents: ['#f0b24a', '#e58a2e', '#efb8d4', '#f5917f', '#cfa456'],
  },
  daylight: {
    name: 'daylight',
    label: 'Daylight',
    hint: 'Warm ivory and espresso type, for reading the menu and the hours in the day.',
    tokens: { surface: '#fbf6ea', raised: '#fffbf0', accent: '#e1553a', text: '#6a3f05', muted: '#8a5620', hairline: 'rgb(106 63 5 / 0.18)' },
    surfaces: ['#fbf6ea', '#fdf3da', '#f3ead6', '#ddb892', '#ffffff'],
    accents: ['#e1553a', '#e65c2e', '#b4441c', '#3f5d45', '#e8a33d'],
  },
};

export interface ResolvedLook {
  preset: PresetName;
  tokens: PresetTokens;
  /** CSS custom properties, ready to emit on :root. */
  vars: Record<string, string>;
  dark: boolean;
  /** What the guardrails changed, in one line each, for the owner. */
  notes: string[];
  /** Colours that were refused outright, with the reason. */
  refused: { dial: 'surface' | 'accent'; reason: string }[];
}

/**
 * Apply the dials to a preset with the guardrails on.
 *
 * Body text, muted text and the accent are each checked against the surface;
 * a failing pair is nudged (lightness only) and the change is named. A colour
 * that cannot be made to pass is refused and the preset's own value stands.
 */
export function resolveLook(appearance: Pick<Appearance, 'preset' | 'surfaceHex' | 'accentHex'>): ResolvedLook {
  const definition = PRESET_DEFINITIONS[appearance.preset] ?? PRESET_DEFINITIONS.evening;
  const tokens: PresetTokens = { ...definition.tokens };
  const notes: string[] = [];
  const refused: ResolvedLook['refused'] = [];

  if (appearance.surfaceHex) {
    const surface = appearance.surfaceHex;
    const dark = isDark(surface);
    // A new surface changes which way "raised" goes and what text can sit on it.
    const text = nudgeToContrast(dark ? '#f7eedc' : '#6a3f05', surface, 4.5);
    const muted = nudgeToContrast(dark ? '#c4ac8c' : '#8a5620', surface, 4.5);
    if (!text || !muted) {
      refused.push({ dial: 'surface', reason: 'No readable text colour exists on that background, so it was not used.' });
    } else {
      tokens.surface = surface;
      tokens.raised = dark ? mix(surface, '#ffffff', 0.05) : mix(surface, '#ffffff', 0.4);
      tokens.text = text.hex;
      tokens.muted = muted.hex;
      tokens.hairline = dark ? 'rgb(255 255 255 / 0.14)' : 'rgb(0 0 0 / 0.16)';
      if (text.changed || muted.changed) notes.push('Text was lightened slightly so it stays readable on that background.');
    }
  }

  if (appearance.accentHex) {
    const clamped = clampAccent(appearance.accentHex);
    if (!clamped) {
      refused.push({ dial: 'accent', reason: 'No button label could be read on that accent, so it was not used.' });
    } else {
      tokens.accent = clamped.accent;
      if (clamped.changed) notes.push('The accent was toned a little so a button label stays readable on it.');
    }
  }

  // The accent as TEXT on the surface (dates, links) must also read.
  const accentOnSurface = nudgeToContrast(tokens.accent, tokens.surface, 3);
  const accentText = accentOnSurface?.hex ?? tokens.accent;
  if (accentOnSurface?.changed) notes.push('The accent is shown a little lighter where it is used as text.');

  const dark = isDark(tokens.surface);
  const label = clampAccent(tokens.accent)?.label ?? (dark ? '#2a1203' : '#2a1203');

  return {
    preset: definition.name,
    tokens,
    dark,
    notes,
    refused,
    vars: varsFor(tokens, accentText, label, dark),
  };
}

/**
 * The full variable set globals.css declares, derived from six roles.
 *
 * The site's components speak in ivory/linen/brown/coral/amber; a look keeps
 * that vocabulary and changes what the words mean.
 */
function varsFor(t: PresetTokens, accentText: string, label: string, dark: boolean): Record<string, string> {
  const lift = (amount: number) => (dark ? mix(t.surface, '#ffffff', amount) : mix(t.surface, '#000000', amount * 0.6));
  return {
    '--color-ivory': t.surface,
    '--color-ivory-deep': lift(0.03),
    '--color-cream': lift(0.02),
    '--color-linen': t.raised,
    '--color-sand': lift(0.08),
    '--color-sand-deep': lift(0.12),
    '--color-brown': t.text,
    '--color-brown-soft': t.muted,
    '--o-brown-line': t.hairline,
    '--color-coral': t.accent,
    '--color-coral-deep': withLightness(t.accent, dark ? 0.7 : 0.4),
    '--color-coral-light': accentText,
    '--color-orange': t.accent,
    '--color-orange-deep': withLightness(t.accent, dark ? 0.7 : 0.4),
    '--color-clay': dark ? accentText : nudgeToContrast(t.accent, t.surface, 4.5)?.hex ?? t.text,
    '--color-on-orange': label,
    '--color-amber': dark ? accentText : t.accent,
    '--color-amber-bright': withLightness(accentText, 0.72),
    '--color-obsidian': dark ? mix(t.surface, '#000000', 0.45) : '#0d0805',
    '--color-espresso': dark ? t.surface : '#1a1008',
    '--color-espresso-lift': dark ? t.raised : '#241708',
    '--color-night-text': '#f7eedc',
    '--color-night-soft': '#c4ac8c',
    '--color-teal': dark ? mix(t.surface, '#000000', 0.35) : '#0f2e2c',
    '--color-teal-lift': dark ? t.raised : '#163f3c',
    '--color-teal-soft': dark ? t.muted : '#9dc0ba',
    '--color-plum': dark ? mix(t.surface, '#000000', 0.25) : '#2e1620',
    '--color-plum-lift': dark ? t.raised : '#43202e',
    '--color-plum-soft': dark ? t.muted : '#d4a7ac',
    '--color-agave-light': dark ? t.muted : '#86a98c',
    '--color-success': dark ? '#8fcf99' : '#2f5434',
    '--color-warning': dark ? '#f0a548' : '#b4441c',
    '--color-danger': dark ? '#f5917f' : '#9b2c1b',
    'color-scheme': dark ? 'dark' : 'light',
  };
}

/** `:root{--a:b;…}` for a set of vars. */
export function cssFor(selector: string, vars: Record<string, string>): string {
  return `${selector}{${Object.entries(vars).map(([key, value]) => `${key}:${value}`).join(';')}}`;
}

/** Every text/surface pair a look must satisfy, with its ratio, for the editor to show. */
export function auditLook(look: ResolvedLook): { pair: string; ratio: number; ok: boolean }[] {
  const { tokens } = look;
  const pairs: [string, string, string, number][] = [
    ['Body text on the background', tokens.text, tokens.surface, 4.5],
    ['Muted text on the background', tokens.muted, tokens.surface, 4.5],
    ['Body text on a panel', tokens.text, tokens.raised, 4.5],
    ['Accent as text on the background', look.vars['--color-clay']!, tokens.surface, 4.5],
    ['Button label on the accent', look.vars['--color-on-orange']!, tokens.accent, 4.5],
  ];
  return pairs.map(([pair, fg, bg, min]) => {
    const ratio = Math.round(contrast(fg, bg) * 100) / 100;
    return { pair, ratio, ok: ratio >= min };
  });
}
