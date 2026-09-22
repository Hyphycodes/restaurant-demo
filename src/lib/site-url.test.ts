import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression tests for site-URL resolution.
 *
 * A defined-but-EMPTY `NEXT_PUBLIC_SITE_URL` reached `new URL('')` and failed a
 * production build with `TypeError: Invalid URL` during "Collecting page data".
 * `??` only falls back on null/undefined, so a blank env var sailed through.
 *
 * These lock in that no env value — blank, whitespace, malformed, or hostile —
 * can ever throw out of this module, because `metadataBase` consumes it at
 * module scope in the root layout and a throw there kills the whole build.
 */

const FALLBACK = 'https://restaurant-demo.vercel.app';

const KEYS = [
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL',
  'NEXT_PUBLIC_VERCEL_URL',
  'VERCEL_URL',
] as const;

let saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

async function loadSiteUrl(): Promise<string> {
  vi.resetModules();
  const mod = await import('./site-url');
  return mod.SITE_URL;
}

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('SITE_URL', () => {
  it('falls back when nothing is set', async () => {
    await expect(loadSiteUrl()).resolves.toBe(FALLBACK);
  });

  it('falls back on an EMPTY value — the bug that failed the build', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = '';
    await expect(loadSiteUrl()).resolves.toBe(FALLBACK);
  });

  it('falls back on a whitespace-only value', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = '   ';
    await expect(loadSiteUrl()).resolves.toBe(FALLBACK);
  });

  it('falls back on a malformed value rather than throwing', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'not a url at all';
    await expect(loadSiteUrl()).resolves.toBe(FALLBACK);
  });

  it('rejects a non-http protocol', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'javascript:alert(1)';
    await expect(loadSiteUrl()).resolves.toBe(FALLBACK);
  });

  it('uses an explicit value', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://cosa-nostra.example';
    await expect(loadSiteUrl()).resolves.toBe('https://cosa-nostra.example');
  });

  it('strips a trailing slash, path, query and hash', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://cosa-nostra.example/some/path?x=1#y';
    await expect(loadSiteUrl()).resolves.toBe('https://cosa-nostra.example');
  });

  it('trims surrounding whitespace', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = '  https://cosa-nostra.example  ';
    await expect(loadSiteUrl()).resolves.toBe('https://cosa-nostra.example');
  });

  it('adds https:// to the bare host Vercel supplies', async () => {
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL = 'cosa-nostra.vercel.app';
    await expect(loadSiteUrl()).resolves.toBe('https://cosa-nostra.vercel.app');
  });

  it('prefers an explicit value over the Vercel-supplied one', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.invalid';
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL = 'cosa-nostra.vercel.app';
    await expect(loadSiteUrl()).resolves.toBe('https://example.invalid');
  });

  it('skips a blank explicit value and uses the next candidate', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = '';
    process.env.NEXT_PUBLIC_VERCEL_URL = 'cosa-nostra-preview.vercel.app';
    await expect(loadSiteUrl()).resolves.toBe('https://cosa-nostra-preview.vercel.app');
  });
});

describe('metadataBase construction', () => {
  it('never throws for any env value the host might supply', async () => {
    const hostile = ['', ' ', '\t\n', 'null', 'undefined', '://', 'http://', 'https://', 'ftp://x'];
    for (const value of hostile) {
      process.env.NEXT_PUBLIC_SITE_URL = value;
      const resolved = await loadSiteUrl();
      // The root layout does exactly this. It must not throw.
      expect(() => new URL(resolved)).not.toThrow();
    }
  });
});
