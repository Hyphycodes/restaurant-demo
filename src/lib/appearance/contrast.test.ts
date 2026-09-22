import { describe, expect, it } from 'vitest';
import { clampAccent, contrast, nudgeToContrast } from './contrast';

describe('contrast', () => {
  it('matches the documented pairs', () => {
    expect(contrast('#6a3f05', '#fdf3da')).toBeCloseTo(8.4, 0);
    expect(contrast('#f7eedc', '#1a1008')).toBeGreaterThan(15);
    expect(contrast('#e65c2e', '#fdf3da')).toBeLessThan(4.5);
  });
});

describe('nudgeToContrast', () => {
  it('leaves a passing colour alone', () => {
    expect(nudgeToContrast('#f7eedc', '#1a1008', 4.5)).toEqual({ hex: '#f7eedc', changed: false });
  });
  it('lightens muted text on a dark surface until it passes', () => {
    const result = nudgeToContrast('#5a4a3a', '#1a1008', 4.5);
    expect(result?.changed).toBe(true);
    expect(contrast(result!.hex, '#1a1008')).toBeGreaterThanOrEqual(4.5);
  });
  it('darkens text on a light surface', () => {
    const result = nudgeToContrast('#c9a47a', '#fbf6ea', 4.5);
    expect(contrast(result!.hex, '#fbf6ea')).toBeGreaterThanOrEqual(4.5);
  });
  it('refuses a mid-grey surface nothing can pass on', () => {
    expect(nudgeToContrast('#808080', '#7f7f7f', 4.5)).not.toBeNull();
    expect(nudgeToContrast('#808080', '#7f7f7f', 7)).toBeNull();
  });
});

describe('clampAccent', () => {
  it('keeps the house amber and gives it a dark label', () => {
    const result = clampAccent('#e8a33d');
    expect(result?.label).toBe('#2a1203');
    expect(contrast(result!.label, result!.accent)).toBeGreaterThanOrEqual(4.5);
  });
  it('lifts a near-black accent into range with a cream label', () => {
    const result = clampAccent('#0a0a30');
    expect(result).not.toBeNull();
    expect(result!.changed).toBe(true);
    expect(contrast(result!.label, result!.accent)).toBeGreaterThanOrEqual(4.5);
  });
  it('tones down neon', () => {
    const result = clampAccent('#00ff00');
    expect(result).not.toBeNull();
    expect(contrast(result!.label, result!.accent)).toBeGreaterThanOrEqual(4.5);
  });
});
