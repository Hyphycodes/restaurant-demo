import { describe, expect, it } from 'vitest';
import { auditLook, PRESETS, resolveLook } from './presets';

describe('resolveLook', () => {
  it('every preset passes AA on every pair out of the box', () => {
    for (const preset of PRESETS) {
      const audit = auditLook(resolveLook({ preset, surfaceHex: null, accentHex: null }));
      expect(audit.every((entry) => entry.ok), `${preset}: ${JSON.stringify(audit)}`).toBe(true);
    }
  });
  it('a custom dark background keeps text readable and says what it nudged', () => {
    const look = resolveLook({ preset: 'evening', surfaceHex: '#2a2a2a', accentHex: null });
    expect(auditLook(look).every((entry) => entry.ok)).toBe(true);
    expect(look.refused).toHaveLength(0);
  });
  it('a custom light background flips to dark text', () => {
    const look = resolveLook({ preset: 'evening', surfaceHex: '#ffffff', accentHex: null });
    expect(look.dark).toBe(false);
    expect(auditLook(look).every((entry) => entry.ok)).toBe(true);
  });
  it('a neon accent is toned rather than refused', () => {
    const look = resolveLook({ preset: 'evening', surfaceHex: null, accentHex: '#39ff14' });
    expect(look.refused).toHaveLength(0);
    expect(look.notes.length).toBeGreaterThan(0);
    expect(auditLook(look).every((entry) => entry.ok)).toBe(true);
  });
  it('a mid-grey background is accepted only by pushing text to near-black, and says so', () => {
    const look = resolveLook({ preset: 'evening', surfaceHex: '#808080', accentHex: null });
    expect(look.refused).toHaveLength(0);
    expect(look.notes.length).toBeGreaterThan(0);
    expect(auditLook(look).every((entry) => entry.ok)).toBe(true);
  });
});
