import Link from 'next/link';
import { Band, Frame } from '@/components/primitives/Band';
import { Eyebrow } from '@/components/primitives/Type';

/**
 * The foot of every page in the contact family.
 *
 * Three destinations, and the one you are already on is dropped rather than
 * greyed out — a card that looks clickable and goes nowhere is worse than one
 * fewer card. Underneath, the two things people sometimes came to /contact
 * looking for and would otherwise have to go back to the navigation for.
 */

const DESTINATIONS = [
  {
    id: 'visit',
    href: '/visit',
    label: 'Visit',
    hint: 'Hours, the address, the room, and how to get here.',
  },
  {
    id: 'careers',
    href: '/careers',
    label: 'Work at Casa Aurelia',
    hint: 'What is open, and a two-minute application.',
  },
  {
    id: 'talent',
    href: '/talent',
    label: 'Create with Casa Aurelia',
    hint: 'DJs, artists, performers — show us what you do.',
  },
] as const;

export function MoreWays({ current }: { current?: 'visit' | 'careers' | 'talent' | 'contact' }) {
  const cards = DESTINATIONS.filter((entry) => entry.id !== current);

  return (
    <Band surface="ivory-deep" size="sm">
      <Frame wide>
        <Eyebrow>Looking for something else?</Eyebrow>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {current !== 'contact' ? (
            <li>
              <MoreCard href="/contact" label="Contact" hint="Everything on one page." />
            </li>
          ) : null}
          {cards.map((entry) => (
            <li key={entry.id}>
              <MoreCard href={entry.href} label={entry.label} hint={entry.hint} />
            </li>
          ))}
        </ul>

        {/* Two whole thoughts, each one unbreakable. As a single sentence
            with a middot between them, a phone split it after the separator
            and stranded "Private events" on a line of its own. */}
        <ul className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-[0.9375rem] text-brown-soft">
          <li>
            Feeding a crowd?{' '}
            <Link
              href="/catering"
              className="font-semibold text-brown underline underline-offset-4 hover:text-clay"
            >
              Catering
            </Link>
          </li>
          <li>
            Taking over the room?{' '}
            <Link
              href="/private-events"
              className="font-semibold text-brown underline underline-offset-4 hover:text-clay"
            >
              Private events
            </Link>
          </li>
        </ul>
      </Frame>
    </Band>
  );
}

function MoreCard({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <Link
      href={href}
      className="group flex h-full min-h-[5.5rem] flex-col justify-center rounded-(--radius-md) border border-brown/20 bg-linen px-5 py-4 transition-colors duration-150 hover:border-clay hover:bg-linen"
    >
      <span className="flex items-center justify-between gap-3">
        <span className="display text-[1.125rem] text-brown group-hover:text-clay">{label}</span>
        <span
          aria-hidden="true"
          className="text-clay transition-transform duration-200 group-hover:translate-x-1"
        >
          →
        </span>
      </span>
      <span className="mt-1.5 text-[0.875rem] leading-snug text-brown-soft">{hint}</span>
    </Link>
  );
}
