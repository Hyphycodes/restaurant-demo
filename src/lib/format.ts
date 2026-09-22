/** Formatting helpers. All money is stored in cents and formatted here only. */

export function formatPrice(cents: number): string {
  const dollars = cents / 100;
  // $16 rather than $16.00 — cleaner in a menu column — but $0.50 keeps its cents.
  return Number.isInteger(dollars)
    ? `$${dollars}`
    : `$${dollars.toFixed(2)}`;
}

export function formatPriceRange(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return min === max ? `${min}` : `${min}–${max}`;
  return String(min ?? max);
}

/** Minutes from midnight → "10am" / "1:30pm". Handles values past 1440. */
export function formatMinutes(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hours24 = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const suffix = hours24 >= 12 ? 'pm' : 'am';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return mins === 0 ? `${hours12}${suffix}` : `${hours12}:${String(mins).padStart(2, '0')}${suffix}`;
}

export function formatPhoneHref(phone: string): string {
  return `tel:+1${phone.replace(/\D/g, '')}`;
}

const DATE_TZ = 'America/Chicago';

export function formatEventDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: DATE_TZ,
  }).format(new Date(iso));
}

export function formatEventDateLong(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: DATE_TZ,
  }).format(new Date(iso));
}

export function formatEventTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: DATE_TZ,
  })
    .format(new Date(iso))
    .replace(' AM', 'am')
    .replace(' PM', 'pm');
}

export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatEventTime(startIso)} – ${formatEventTime(endIso)}`;
}

/** "Sat Sep 19" — the short form the event page and tiles use. No comma. */
export function formatEventDateCompact(iso: string): string {
  return formatEventDate(iso).replace(',', '');
}

/**
 * "12–3pm", "7–10pm", "9:30pm–1am".
 *
 * The suffix is written once when both ends share it, and ":00" is dropped,
 * because that is how a person says it. Both ends keep their own suffix when
 * a night crosses noon or midnight.
 */
export function formatTimeRangeCompact(startIso: string, endIso: string): string {
  const start = formatEventTime(startIso).replace(':00', '');
  const end = formatEventTime(endIso).replace(':00', '');
  const suffix = /am|pm/;
  const startSuffix = start.match(suffix)?.[0];
  const endSuffix = end.match(suffix)?.[0];
  if (startSuffix && startSuffix === endSuffix) {
    return `${start.replace(suffix, '')}–${end}`;
  }
  return `${start}–${end}`;
}
