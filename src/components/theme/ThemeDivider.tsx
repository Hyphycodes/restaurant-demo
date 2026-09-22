import { ThemeCharacter } from './ThemeCharacter';
import { getActiveTheme } from '@/themes/resolve';

/** Seasonal transitions are small inhabited scenes, rather than floral rules. */
export { ThemeWorld } from './ThemeWorld';

/** Foreground artwork in the footer's corners. */
export async function ThemeFooterLayer() {
  const theme = await getActiveTheme();
  if (!theme.definition || !theme.config.options.edges) return null;
  const art = theme.assets.foregroundDecoration;
  if (!art.path) return null;

  return (
    <div aria-hidden="true" className="theme-footer">
      <div className="theme-footer-companions"><ThemeCharacter name="martini" /><ThemeCharacter name="supper-guests" /><ThemeCharacter name="pasta-couple" /></div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={art.path} alt="" className="theme-footer-left" loading="lazy" decoding="async" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={art.path} alt="" className="theme-footer-right" loading="lazy" decoding="async" />
    </div>
  );
}
