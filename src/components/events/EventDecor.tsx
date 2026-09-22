import { ThemeCharacter, type ThemeCharacterName } from '@/components/theme/ThemeCharacter';
import { getActiveTheme } from '@/themes/resolve';

/**
 * Seasonal decoration for the event section, constrained.
 *
 * One `aria-hidden` layer, absolutely positioned and clipped by the section.
 * At most four guests, all pinned to the section's edges inside its own
 * padding, so none can land on a word — and none of them ever enters the
 * ticket column. Motion lives in event-page.css and stops on phones and
 * under reduced motion.
 */
const CAST: Record<string, ThemeCharacterName[]> = {
  'vinyl-vermouth': ['aperitivo', 'selector', 'dancer', 'supper-guests'],
  brunch: ['night-guests', 'aperitivo', 'pasta-couple', 'host'],
  comedy: ['record-collector', 'martini', 'dancer', 'host'],
  nightlife: ['night-guests', 'record-collector', 'martini', 'pasta-couple'],
  special: ['martini', 'host', 'aperitivo', 'supper-guests'],
};

export async function EventDecor({ category }: { category: string | null }) {
  const theme = await getActiveTheme();
  if (!theme.definition || !theme.config.options.edges) return null;
  const guests = CAST[category ?? 'special'] ?? CAST.special!;
  return (
    <div className="event-decor" aria-hidden="true">
      {guests.slice(0, 4).map((name, index) => (
        <ThemeCharacter key={name} name={name} className={`event-decor-guest event-decor-guest-${index}`} />
      ))}
    </div>
  );
}
