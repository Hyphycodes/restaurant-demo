import { getActiveTheme } from '@/themes/resolve';
import { ThemeCharacter, type ThemeCharacterName } from './ThemeCharacter';

const scenes = {
  welcome: ['martini', 'host'],
  listening: ['selector', 'dancer'],
  music: ['night-guests', 'record-collector'],
  table: ['supper-guests', 'pasta-couple'],
  celebration: ['aperitivo', 'martini'],
} satisfies Record<string, ThemeCharacterName[]>;

/** A little inhabited space between content, with no copy or competing action. */
export async function ThemeWorld({ scene = 'welcome' }: { scene?: keyof typeof scenes }) {
  const theme = await getActiveTheme();
  if (!theme.definition || !theme.config.options.edges) return null;
  return <div className="theme-world" data-scene={scene} aria-hidden="true">
    <span className="theme-world-orbit" />
    {scenes[scene].map((name, index) => <ThemeCharacter key={name} name={name} className={`theme-world-guest theme-world-guest-${index}`} />)}
    <span className="theme-world-star theme-world-star-one">✦</span>
    <span className="theme-world-star theme-world-star-two">✧</span>
    <span className="theme-world-star theme-world-star-three">✦</span>
  </div>;
}

/** Peripheral companions stay outside the reading column and never intercept input. */
export function ThemeWorldEdges() {
  return <div className="theme-world-edges" aria-hidden="true">
    {(['martini','night-guests','host','selector','record-collector','dancer'] as const).map((name,index) => <ThemeCharacter key={name} name={name} className={`theme-edge-guest theme-edge-guest-${index}`} />)}
  </div>;
}

/**
 * Sunday Club leans up out of the action rail on phones and tablets, where the
 * hero has no room for him. From 1024px the hero companion takes over and
 * this renders nothing (see theme.css).
 */
export async function ThemeRailGuest() {
  const theme = await getActiveTheme();
  if (!theme.definition || !theme.config.options.edges) return null;
  return <ThemeCharacter name="supper-guests" className="theme-rail-guest" />;
}

/**
 * Place inside a relative photo composition, away from words and controls.
 *
 * `className` exists for compositions whose lower edge is not the photograph —
 * a grid with a caption under each tile, say — so the guest can be lifted clear
 * of the words instead of sitting on them.
 */
export async function ThemePhotoGuest({
  name,
  className = '',
}: {
  name: ThemeCharacterName;
  className?: string;
}) {
  const theme = await getActiveTheme();
  if (!theme.definition || !theme.config.options.edges) return null;
  return <ThemeCharacter name={name} className={`theme-photo-guest ${className}`} />;
}
