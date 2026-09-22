import type { CSSProperties, ReactNode } from 'react';
import type { ResolvedTheme } from '@/themes/types';
import { ThemeAtmosphere } from './ThemeAtmosphere';
import { ThemeAttribute } from './ThemeAttribute';

/**
 * The one place a theme is switched on.
 *
 * With the default look active this renders its children and nothing else, so
 * the everyday site is byte-for-byte what it was. With a seasonal theme it adds
 * a wrapper carrying `data-theme`, which is the selector the theme's CSS keys
 * every token remap and every layer off, plus the numbers an intensity preset
 * chose — as custom properties, so the CSS never has to know about presets.
 */
export function ThemeRoot({ theme, children }: { theme: ResolvedTheme; children: ReactNode }) {
  if (!theme.definition) return <>{children}</>;

  const { config, preset, assets, definition } = theme;
  const motion = config.options.motion ? 'on' : 'off';

  const vars = {
    // The record is the page surface the appearance row chose; the theme's
    // own plum is only the fallback.
    '--t-record': 'var(--color-ivory)',
    '--t-glow': config.options.glow ? preset.glow : 0,
    '--t-texture': config.options.texture ? preset.texture : 0,
    '--t-vignette': preset.vignette,
    '--t-edges': preset.edges,
    '--t-texture-image': assets.texture.path ? `url("${assets.texture.path}")` : 'none',
    '--t-petal-image': assets.petals.path ? `url("${assets.petals.path}")` : 'none',
  } as CSSProperties;

  return (
    <div
      data-theme={theme.slug}
      data-palette="appearance"
      data-intensity={config.intensity}
      data-motion={motion}
      className="theme-root"
      style={vars}
    >
      {/* Overscroll and the area behind a portal must match the record, and
          they belong to <html>, which this component cannot reach at render. */}
      <style>{`html{background-color:var(--color-ivory, ${definition.record})}`}</style>
      <ThemeAttribute slug={theme.slug} motion={motion} />
      <ThemeAtmosphere theme={theme} />
      {children}
    </div>
  );
}
