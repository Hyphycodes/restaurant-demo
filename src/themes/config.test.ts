import { describe, expect, it } from 'vitest';
import { normalizeConfig } from './config';
import { HALLOWEEN_DEFAULTS } from './registry';

describe('normalizeConfig', () => {
  it('returns the defaults for nothing at all', () => {
    expect(normalizeConfig(null, HALLOWEEN_DEFAULTS)).toEqual(HALLOWEEN_DEFAULTS);
    expect(normalizeConfig('junk', HALLOWEEN_DEFAULTS)).toEqual(HALLOWEEN_DEFAULTS);
  });

  it('keeps known values and drops unknown ones', () => {
    const config = normalizeConfig(
      {
        options: { petals: false, glow: 'yes', sparkle: true },
        intensity: 'full',
        assets: { texture: ' plaster-01 ', bogus: 'x', divider: 42 },
        extra: 1,
      },
      HALLOWEEN_DEFAULTS,
    );
    expect(config.options.petals).toBe(false);
    expect(config.options.glow).toBe(true);
    expect(config.intensity).toBe('full');
    expect(config.assets).toEqual({ texture: 'plaster-01' });
  });

  it('falls back on an unknown intensity', () => {
    expect(normalizeConfig({ intensity: 'maximum' }, HALLOWEEN_DEFAULTS).intensity).toBe('standard');
  });
});
