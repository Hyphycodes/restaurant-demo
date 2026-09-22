import { PRESETS } from './registry';
import {
  THEME_ASSET_SLOTS,
  THEME_INTENSITIES,
  THEME_OPTIONS,
  type ThemeConfig,
  type ThemeIntensity,
  type ThemePreset,
} from './types';

/**
 * Stored config → a complete, safe config.
 *
 * The public site reads this on every render, so it is lenient by design: an
 * unknown key is ignored, a missing key takes the theme's default, and nothing
 * here can throw. Strict validation of what an admin SUBMITS lives in the
 * server action; this is what happens to whatever ended up in the database.
 */
export function normalizeConfig(raw: unknown, defaults: ThemeConfig): ThemeConfig {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const rawOptions = (input.options && typeof input.options === 'object' ? input.options : {}) as Record<
    string,
    unknown
  >;
  const options = { ...defaults.options };
  for (const option of THEME_OPTIONS) {
    if (typeof rawOptions[option] === 'boolean') options[option] = rawOptions[option] as boolean;
  }

  const intensity = isIntensity(input.intensity) ? input.intensity : defaults.intensity;

  const rawAssets = (input.assets && typeof input.assets === 'object' ? input.assets : {}) as Record<
    string,
    unknown
  >;
  const assets: ThemeConfig['assets'] = {};
  for (const slot of THEME_ASSET_SLOTS) {
    const value = rawAssets[slot];
    if (typeof value === 'string' && value.trim()) assets[slot] = value.trim();
  }

  return { options, intensity, assets };
}

export function isIntensity(value: unknown): value is ThemeIntensity {
  return typeof value === 'string' && (THEME_INTENSITIES as readonly string[]).includes(value);
}

export function presetFor(intensity: ThemeIntensity): ThemePreset {
  return PRESETS[intensity];
}
