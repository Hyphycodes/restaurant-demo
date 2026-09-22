/**
 * Canonical origin resolution.
 *
 * Deliberately a standalone, JSX-free module: it is consumed at module scope by
 * the root layout's `metadataBase`, so a throw here fails the entire production
 * build during "Collecting page data" rather than degrading one page.
 *
 * That is not hypothetical. A `NEXT_PUBLIC_SITE_URL` that was defined but EMPTY
 * reached `new URL('')` and failed the build with `TypeError: Invalid URL`,
 * because `??` only falls back on null/undefined and a blank string is neither.
 *
 * So: every candidate is trimmed, emptiness-checked, protocol-normalised and
 * parsed inside a try. Anything unusable is skipped, never propagated.
 */

export const FALLBACK_SITE_URL = 'https://restaurant-demo.vercel.app';

/**
 * Order matters. An explicit NEXT_PUBLIC_SITE_URL always wins; otherwise a
 * Vercel deployment describes itself, so a preview emits its own canonical URLs
 * instead of claiming to be production.
 */
export function resolveSiteUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
    process.env.NEXT_PUBLIC_VERCEL_URL,
    process.env.VERCEL_URL,
  ];

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (!trimmed) continue;

    // Vercel supplies a bare host with no scheme.
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    try {
      const url = new URL(withProtocol);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
      if (!url.hostname) continue;
      // `.origin` drops any trailing slash, path, query or hash.
      return url.origin;
    } catch {
      // Unusable value — try the next candidate rather than failing the build.
    }
  }

  return FALLBACK_SITE_URL;
}

export const SITE_URL = resolveSiteUrl();

export function absoluteUrl(path = '/'): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
