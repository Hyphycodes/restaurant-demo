import { DEMO_MODE } from '@/lib/demo';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { getSiteSettings } from '@/content/resolve';
import { findStandaloneEvent } from '@/lib/events';
import { formatEventDateLong, formatTimeRangeCompact } from '@/lib/format';
import { priceHeadline } from '@/lib/ticketing/offer';
import { getPublicEvents } from '@/server/content/events';
import { resolveEventArtwork } from '@/server/content/event-art';
import { getTicketOffer } from '@/server/ticketing/offer';

export const alt = 'Event at Casa Aurelia';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * The share card for an event whose flyer is not a landscape.
 *
 * Restaurants print flyers square, and a square flyer stretched into a
 * 1.91:1 card is the single ugliest thing a share can do. So the card is
 * composed: the flyer whole on the right, the name and date set in the brand
 * surface on the left. The flyer is inlined as bytes so the card never depends
 * on the crawler being able to fetch a second URL.
 */
export default async function EventOpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [input, settings] = await Promise.all([getPublicEvents(), getSiteSettings()]);
  const event = findStandaloneEvent(input, slug);
  const series = event ? null : input.series.find((entry) => entry.slug === slug);

  const title = event?.title ?? series?.title ?? settings.name;
  const dateLine = event
    ? `${formatEventDateLong(event.startsAt)} · ${formatTimeRangeCompact(event.startsAt, event.endsAt)}`
    : series
      ? 'Every week at Casa Aurelia'
      : '';
  const priceLine = event ? priceHeadline(await getTicketOffer(event)) : '';
  const flyer = event ? (await resolveEventArtwork(event)).flyer : null;
  const flyerSrc = flyer?.path ? await inline(flyer.path) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#1a1008',
          color: '#f7eedc',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flex: 1,
            padding: '64px 56px 56px 72px',
          }}
        >
          <div style={{ display: 'flex', fontSize: 22, letterSpacing: 5, textTransform: 'uppercase', color: '#e8a33d', fontWeight: 600 }}>
            Casa Aurelia · Italian supper club
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ display: 'flex', fontSize: title.length > 28 ? 60 : 76, lineHeight: 1, fontWeight: 700, textTransform: 'uppercase', letterSpacing: -1 }}>
              {title}
            </div>
            {dateLine ? <div style={{ display: 'flex', fontSize: 28, color: '#e8a33d' }}>{dateLine}</div> : null}
            {priceLine ? <div style={{ display: 'flex', fontSize: 26, color: '#c4ac8c' }}>{priceLine}</div> : null}
          </div>
          <div style={{ display: 'flex', fontSize: 22, color: '#c4ac8c', borderTop: '2px solid #e8a33d', paddingTop: 20 }}>
            {settings.street}, {settings.locality}, {settings.region}
          </div>
        </div>
        {flyerSrc ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 470,
              padding: 40,
              background: '#241708',
            }}
          >
            <img src={flyerSrc} alt="" style={{ maxWidth: 390, maxHeight: 550, objectFit: 'contain', borderRadius: 16 }} />
          </div>
        ) : null}
      </div>
    ),
    size,
  );
}

async function inline(flyerPath: string): Promise<string | null> {
  try {
    if (flyerPath.startsWith('/')) {
      const bytes = await readFile(path.join(process.cwd(), 'public', flyerPath));
      const mime = flyerPath.endsWith('.png') ? 'image/png' : flyerPath.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
      return `data:${mime};base64,${bytes.toString('base64')}`;
    }
    if (DEMO_MODE) return null;
    const response = await fetch(flyerPath, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;
    const mime = response.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg';
    return `data:${mime};base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}`;
  } catch {
    return null;
  }
}
