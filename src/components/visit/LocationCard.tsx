import Link from 'next/link';
import { Asset } from '@/components/media/Asset';
import { Display } from '@/components/primitives/Type';
import { formatPhoneHref } from '@/lib/format';
import type { VisitLocation } from '@/lib/visit';
import { DirectionsButton } from './DirectionsButton';



export function OpenChip({ open, label, tone = 'light' }: { open: boolean; label: string; tone?: 'light' | 'dark' }) {
  const dark = tone === 'dark';
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.8125rem] font-semibold ${
        open
          ? dark
            ? 'border-agave-light/50 bg-agave-light/12 text-agave-light'
            : 'border-success/40 bg-success/8 text-success'
          : dark
            ? 'border-night-text/25 text-night-soft'
            : 'border-brown/25 text-brown-soft'
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block size-1.5 rounded-full ${
          open ? (dark ? 'bg-agave-light' : 'bg-success') : dark ? 'bg-night-soft' : 'bg-brown-soft'
        }`}
      />
      {label}
    </span>
  );
}

function PhoneIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6.5 3.5h3l1.5 4-2 1.3a12 12 0 0 0 5.2 5.2l1.3-2 4 1.5v3a1.5 1.5 0 0 1-1.7 1.5C11.2 17.4 6.6 12.8 5 5.2A1.5 1.5 0 0 1 6.5 3.5z" />
    </svg>
  );
}

/** The grouped week. Four or five rows, never seven near-identical ones. */
export function HoursList({ location, tone = 'light' }: { location: VisitLocation; tone?: 'light' | 'dark' }) {
  const dark = tone === 'dark';
  return (
    <dl className={`border-t ${dark ? 'border-night-text/15' : 'border-brown/15'}`}>
      {location.hours.map((group) => (
        <div
          key={group.label}
          className={`flex items-baseline justify-between gap-6 border-b py-2.5 text-[0.9375rem] ${
            dark ? 'border-night-text/15' : 'border-brown/15'
          }`}
        >
          <dt className={dark ? 'text-night-soft' : 'text-brown-soft'}>{group.label}</dt>
          <dd className={`tabular font-medium ${dark ? 'text-night-text' : 'text-brown'}`}>{group.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LocationCard({
  location,
  priority = false,
  
  showName = true,
}: {
  location: VisitLocation;
  priority?: boolean;
  showName?: boolean;
}) {
  const secondary =
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-(--radius-md) border border-brown/25 bg-linen/60 px-5 text-[0.9375rem] font-semibold text-brown transition-colors hover:border-brown/45 hover:bg-linen';

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-12">
      <div className="lg:col-span-6">
        <OpenChip open={location.open.open} label={location.open.label} />

        {showName ? (
          <Display as="h2" size="lg" className="mt-4 text-brown">
            {location.name}
          </Display>
        ) : null}

        {/* The address IS the directions control: one large target that says
            where you are going, rather than text you cannot press beside a
            button that does not say the address. */}
        <DirectionsButton
          className="mt-5"
          appearance="address"
          maps={location.maps}
          address={location.addressOneLine}
        >
          {location.street}
          <br />
          {location.cityLine}
        </DirectionsButton>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <a href={formatPhoneHref(location.phone)} className={`tabular ${secondary}`}>
            <PhoneIcon />
            {location.phone}
            <span className="sr-only">— call Cosa Nostra</span>
          </a>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/menu" className={secondary}>
              Menu
            </Link>
            <Link href="/events" className={secondary}>
              Events
            </Link>
          </div>
        </div>

        <div className="mt-8">
          <p className="eyebrow text-brown-soft">Hours</p>
          <div className="mt-3">
            <HoursList location={location} />
          </div>
        </div>
      </div>

      <div className="lg:col-span-6">
        <Asset
          id={location.photoAssetId}
          className="aspect-4/3 w-full"
          sizes="(min-width: 1024px) 46vw, 100vw"
          priority={priority}
        />
      </div>
    </div>
  );
}
