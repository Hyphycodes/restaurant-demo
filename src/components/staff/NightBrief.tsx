import Link from 'next/link';
import type { EventBrief } from '@/content/staff-types';
import { formatClockShort } from '@/lib/staff/time';
import { Pill } from './ui';

/**
 * What the floor is told about a night.
 *
 * The same panel on Home and on the event screen, because the information
 * an employee needs does not change depending on where they tapped. Money
 * is not a prop here at all — a screen cannot leak what it was never given.
 */
export function NightBrief({
  title,
  subtitle,
  href,
  startsAt,
  doorsAt,
  timezone,
  crowd,
  crowdLabel,
  brief,
  myRole,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  startsAt: string;
  doorsAt: string | null;
  timezone: string;
  crowd: number | null;
  crowdLabel: string | null;
  brief: EventBrief | null;
  myRole: string | null;
  compact?: boolean;
}) {
  const facts = [
    { label: 'Doors', value: doorsAt ? formatClockShort(doorsAt, timezone) : formatClockShort(startsAt, timezone) },
    ...(crowd !== null ? [{ label: crowdLabel === 'expected' ? 'Expected' : 'Tickets out', value: String(crowd) }] : []),
    ...(brief?.callTimeAt ? [{ label: 'Be in by', value: formatClockShort(brief.callTimeAt, timezone) }] : []),
    ...(brief?.dressCode ? [{ label: 'Dress', value: brief.dressCode }] : []),
    ...(brief?.managerName ? [{ label: 'Running it', value: brief.managerName }] : []),
    ...(myRole ? [{ label: 'You', value: myRole }] : []),
  ];

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`font-semibold text-brown ${compact ? 'text-[1rem]' : 'text-[1.125rem]'}`}>{title}</p>
          {subtitle ? <p className="mt-0.5 text-[0.8125rem] text-brown-soft">{subtitle}</p> : null}
        </div>
        {myRole ? <Pill tone="accent">You’re on</Pill> : null}
      </div>
      <dl className="mt-2.5 flex flex-wrap gap-x-6 gap-y-2">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-brown-soft">{fact.label}</dt>
            <dd className="text-[0.9375rem] text-brown">{fact.value}</dd>
          </div>
        ))}
      </dl>
      {brief?.staffNotes ? <p className="mt-3 rounded-(--radius-sm) bg-brown/8 px-3 py-2 text-[0.875rem] leading-relaxed text-brown">{brief.staffNotes}</p> : null}
    </>
  );

  return href ? (
    <Link href={href} className="staff-panel block px-4 py-3.5 transition-colors active:bg-brown/6">
      {body}
    </Link>
  ) : (
    <div className="staff-panel px-4 py-3.5">{body}</div>
  );
}
