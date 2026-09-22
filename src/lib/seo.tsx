import type { Metadata } from 'next';
import { allMenus } from '@/content/menu';
import { site } from '@/content/site';
import type { ResolvedEvent, SiteSettings } from '@/content/types';
import type { TicketOffer } from '@/lib/ticketing/offer';
import { toSchemaHours } from './hours';
import { absoluteUrl, SITE_URL } from './site-url';

export { absoluteUrl, SITE_URL };


export function buildMetadata({
  title,
  description,
  path,
  images,
}: {
  title: string;
  description: string;
  path: string;
  images?: string[];
}): Metadata {
  const url = absoluteUrl(path);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: site.name,
      type: 'website',
      locale: 'en_US',
      ...(images ? { images } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(images ? { images } : {}),
    },
  };
}

/**
 * Restaurant structured data.
 *
 * Built ONLY from verified facts. `geo` is omitted rather than guessed, `email`
 * is omitted because none is published, and `priceRange` comes from the actual
 * menu. Hours come from the same source of truth the footer renders, so the two
 * can never drift apart.
 */
export function restaurantJsonLd(settings: SiteSettings = site) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': `${SITE_URL}/#restaurant`,
    name: settings.name,
    url: SITE_URL,
    telephone: settings.phone.value,
    servesCuisine: settings.cuisine,
    priceRange: settings.priceRange,
    address: {
      '@type': 'PostalAddress',
      streetAddress: settings.street,
      addressLocality: settings.locality,
      addressRegion: settings.region,
      postalCode: settings.postalCode,
      addressCountry: settings.country,
    },
    openingHoursSpecification: toSchemaHours(settings.hours.value),
    acceptsReservations: settings.reservationUrl,
    hasMenu: allMenus.map((menu) => ({
      '@type': 'Menu',
      name: `${menu.title} menu`,
      url: absoluteUrl(menu.slug === 'food' ? '/menu' : `/menu/${menu.slug}`),
    })),
    sameAs: settings.socials.map((social) => social.url),
    potentialAction: {
      '@type': 'OrderAction',
      target: settings.orderUrl,
    },
  };
}

export function menuJsonLd(menu: (typeof allMenus)[number]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    name: `${menu.title} menu — ${site.name}`,
    hasMenuSection: menu.categories.map((category) => ({
      '@type': 'MenuSection',
      name: category.name,
      hasMenuItem: category.items.map((item) => ({
        '@type': 'MenuItem',
        name: item.name,
        ...(item.description ? { description: item.description } : {}),
        // A null price is omitted entirely. It is never emitted as 0.
        ...(item.priceCents != null
          ? {
              offers: {
                '@type': 'Offer',
                price: (item.priceCents / 100).toFixed(2),
                priceCurrency: 'USD',
              },
            }
          : {}),
      })),
    })),
  };
}

const EVENT_STATUS: Record<string, string> = {
  scheduled: 'https://schema.org/EventScheduled',
  'sold-out': 'https://schema.org/EventScheduled',
  cancelled: 'https://schema.org/EventCancelled',
  postponed: 'https://schema.org/EventPostponed',
  free: 'https://schema.org/EventScheduled',
};

/**
 * Event structured data.
 *
 * Built from the occurrence's own resolved values, so a night with its own name,
 * artwork or admission is described accurately — and never from artwork. The
 * offer, when supplied, decides the price and availability Google shows; the
 * image is the flyer, absolute, because a crawler has no idea what our origin is.
 */
export function eventJsonLd(
  event: ResolvedEvent,
  settings: SiteSettings = site,
  extras: { offer?: TicketOffer; image?: string | null } = {},
) {
  const pageUrl = absoluteUrl(event.slug ? `/events/${event.slug}` : '/events');
  const upcoming = Date.parse(event.endsAt) > Date.now();
  const running = !['cancelled', 'postponed'].includes(event.status);
  const offer = extras.offer;

  let offers: object | object[] | undefined;
  if (offer && upcoming && running) {
    if (offer.kind === 'tiers') {
      offers = offer.tiers.map((tier) => ({
        '@type': 'Offer',
        name: tier.name,
        price: (tier.priceCents / 100).toFixed(2),
        priceCurrency: 'USD',
        url: pageUrl,
        availability:
          !tier.onSale || (tier.available !== null && tier.available <= 0)
            ? 'https://schema.org/SoldOut'
            : 'https://schema.org/InStock',
        validFrom: new Date().toISOString(),
      }));
    } else if (offer.kind === 'free') {
      offers = { '@type': 'Offer', price: '0.00', priceCurrency: 'USD', url: pageUrl, availability: 'https://schema.org/InStock' };
    } else if (offer.kind === 'pending') {
      // Ticketing is on but there is nothing priced yet — no offer to claim.
    } else {
      // A price is only stated when one is known. An outside seller's page is
      // still the offer's home, so the link and availability are always there.
      offers = {
        '@type': 'Offer',
        ...(offer.priceCents !== null
          ? { price: (offer.priceCents / 100).toFixed(2), priceCurrency: 'USD' }
          : {}),
        url: offer.kind === 'external' ? offer.url : pageUrl,
        availability: offer.soldOut ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
        validFrom: new Date().toISOString(),
      };
    }
  } else if (!offer && event.priceCents != null && event.ticketUrl && upcoming && running) {
    offers = {
      '@type': 'Offer',
      price: (event.priceCents / 100).toFixed(2),
      priceCurrency: 'USD',
      url: event.ticketUrl,
      availability: event.status === 'sold-out' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      validFrom: new Date().toISOString(),
    };
  }

  const free = offer ? offer.kind === 'free' : event.priceCents === 0;

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.description || event.summary,
    startDate: event.startsAt,
    endDate: event.endsAt,
    ...(extras.image ? { image: [extras.image] } : {}),
    ...(offer || event.priceCents != null ? { isAccessibleForFree: free } : {}),
    eventStatus: EVENT_STATUS[event.status] ?? EVENT_STATUS.scheduled,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url: pageUrl,
    location: {
      '@type': 'Place',
      name: event.venueName,
      address: {
        '@type': 'PostalAddress',
        streetAddress: settings.street,
        addressLocality: settings.locality,
        addressRegion: settings.region,
        postalCode: settings.postalCode,
        addressCountry: settings.country,
      },
    },
    organizer: { '@type': 'Organization', name: settings.name, url: SITE_URL },
    ...(offers ? { offers } : {}),
    ...(event.ageMin ? { typicalAgeRange: `${event.ageMin}-` } : {}),
  };
}

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // Structured data is generated from typed content, never user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
