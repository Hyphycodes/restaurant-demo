import { ThemeCharacter } from './ThemeCharacter';
import type { ResolvedTheme } from '@/themes/types';

/**
 * The hero's seasonal composition: editorial ribbons overhead, brass details entering
 * from the edges, and a candle-warm haze low in the frame.
 *
 * Rendered INSIDE the hero, after the scrims and before the headline, so the
 * artwork sits over the reel and under the type. Positions are set in the
 * theme's CSS per breakpoint; on phones the clusters move to the top corners so
 * they never cover the headline or the actions.
 */
export function ThemeHeroLayer({ theme }: { theme: ResolvedTheme }) {
  if (!theme.definition || !theme.config.options.edges) return null;
  const { topDecoration, leftDecoration, rightDecoration } = theme.assets;

  return (
    <div aria-hidden="true" className="theme-hero">
      <div className="theme-hero-haze" />
      <ThemeCharacter name="supper-guests" className="theme-hero-companion" />
      {theme.config.options.glow ? <div className="theme-hero-candle" /> : null}
      {topDecoration.path ? (
        <>
          {/* A second, dimmer string hangs behind the first: two planes read
              as depth where one reads as a sticker. Same file, no extra bytes. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={topDecoration.path}
            alt=""
            className="theme-hero-top theme-hero-top-back"
            decoding="async"
            fetchPriority="low"
          />
          {/* Decorative artwork with no intrinsic layout role; plain <img>
              keeps it out of the image optimizer and off the LCP path. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={topDecoration.path}
            alt=""
            className="theme-hero-top"
            decoding="async"
            fetchPriority="low"
          />
        </>
      ) : null}
      {leftDecoration.path ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={leftDecoration.path}
          alt=""
          className="theme-hero-left"
          decoding="async"
          fetchPriority="low"
        />
      ) : null}
      {rightDecoration.path ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={rightDecoration.path}
          alt=""
          className="theme-hero-right"
          decoding="async"
          fetchPriority="low"
        />
      ) : null}
    </div>
  );
}


export function ThemeHeroBackground({ theme }: { theme: ResolvedTheme }) {
  const asset = theme.assets.heroBackground;
  if (!asset.path) return null;

  if (asset.kind === 'video') {
    return (
      <video
        className="absolute inset-0 size-full object-cover"
        src={asset.path}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        tabIndex={-1}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={asset.path} alt="" className="absolute inset-0 size-full object-cover" />;
}
