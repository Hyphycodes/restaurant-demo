import type { CSSProperties } from 'react';
import type { ResolvedTheme } from '@/themes/types';

/**
 * The site-wide seasonal environment: candle glow and far stars behind the
 * content, texture and vignette in front of it, and petals drifting down the
 * viewport.
 *
 * Everything here is fixed, `aria-hidden`, and `pointer-events: none`, and none
 * of it is a client component — the petals are plain spans whose positions are
 * decided on the server from a seeded generator, so the markup is stable across
 * renders and there is nothing to hydrate. Motion is CSS keyframes only; the
 * theme's CSS freezes it under `prefers-reduced-motion` and when the admin turns
 * motion off.
 */
export function ThemeAtmosphere({ theme }: { theme: ResolvedTheme }) {
  const { options } = theme.config;
  const petals = options.petals ? makePetals(theme.preset.petals.desktop, theme.preset.petals.mobile) : [];

  return (
    <div aria-hidden="true" className="theme-atmosphere">
      {options.glow ? (
        <>
          <div className="theme-layer theme-layer-glow" />
          <div className="theme-layer theme-layer-glow theme-layer-glow-2" />
          <div className="theme-layer theme-layer-haze" />
        </>
      ) : null}
      {/* Far stars, behind everything, so the page reads as one open night
          rather than a stack of coloured bands. Two layers twinkle out of
          phase; both are plain gradients, nothing to download. */}
      <div className="theme-layer theme-layer-stars" />
      <div className="theme-layer theme-layer-stars theme-layer-stars-2" />
      {options.texture ? <div className="theme-layer theme-layer-texture" /> : null}
      <div className="theme-layer theme-layer-vignette" />
      {petals.length > 0 ? (
        <div className="theme-petals">
          {petals.map((petal) => (
            <span
              key={petal.key}
              className={petal.mobile ? 'theme-petal' : 'theme-petal theme-petal-wide'}
              style={petal.style}
            >
              <i />
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Deterministic pseudo-random, so the same theme always lays out the same
 * petals. A different `count` produces a different but equally stable field.
 */
function makePetals(desktop: number, mobile: number) {
  let seed = 20261031 + desktop * 7;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const between = (min: number, max: number) => min + next() * (max - min);

  return Array.from({ length: desktop }, (_, index) => {
    const duration = between(16, 30);
    return {
      key: index,
      mobile: index < mobile,
      style: {
        left: `${between(2, 98).toFixed(1)}%`,
        '--t-dur': `${duration.toFixed(1)}s`,
        '--t-delay': `${(-between(0, duration)).toFixed(1)}s`,
        '--t-size': `${between(9, 17).toFixed(0)}px`,
        '--t-sway': `${between(24, 70).toFixed(0)}px`,
        '--t-sway-dur': `${between(3.5, 6.5).toFixed(1)}s`,
        '--t-spin': `${between(240, 720).toFixed(0)}deg`,
        '--t-alpha': between(0.45, 0.85).toFixed(2),
      } as CSSProperties,
    };
  });
}
