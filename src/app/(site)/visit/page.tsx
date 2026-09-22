import type { Metadata } from 'next';
import { Asset } from '@/components/media/Asset';
import { Band, Frame } from '@/components/primitives/Band';
import { ExternalButtonLink, ExternalTextLink } from '@/components/primitives/Button';
import { Display, Eyebrow } from '@/components/primitives/Type';
import { ThemePhotoGuest, ThemeWorld } from '@/components/theme/ThemeWorld';
import { LocationCard } from '@/components/visit/LocationCard';
import { MoreWays } from '@/components/visit/MoreWays';
import { pageCopy, seo } from '@/content/pages';
import { getSiteSettings } from '@/content/resolve';
import { buildMetadata } from '@/lib/seo';
import { buildVisitLocations } from '@/lib/visit';
import { getPageCopy } from '@/server/content/pages';

export const metadata: Metadata = buildMetadata({ ...seo.visit!, path: '/visit' });

// Hourly — the open/closed state changes through the day.
export const revalidate = 3600;

/**
 * Visit.
 *
 * The full version of what /contact previews: the same address card, the same
 * directions chooser and the same hours — one component, so the two pages
 * cannot disagree — and then everything a guest wants once they have decided
 * to come. Booking and ordering, the room itself, and where to follow us.
 *
 * There is still no interactive map embed. It would load a third-party script
 * and cost a network round trip before the guest has shown any intent;
 * "Get directions" opens the real map, in their own app, when they want it.
 */
export default async function VisitPage() {
  // Address, phone and links come from settings, so an edit in the admin
  // reaches every page rather than only the ones somebody remembered. The
  // heading comes from the page record, so the control in the admin does
  // something — the address underneath it is still single-sourced.
  const [site, copy] = await Promise.all([getSiteSettings(), getPageCopy('visit')]);
  const locations = buildVisitLocations(site);

  return (
    <>
      <Band surface="sand" size="sm">
        <Frame wide>
          <Eyebrow>{copy.eyebrow ?? pageCopy.visit.eyebrow}</Eyebrow>
          <Display as="h1" size="lg" className="mt-3 max-w-[16ch] text-brown">
            {copy.heading}
          </Display>
          <p className="measure-lead mt-4 text-[length:var(--text-body-lg)] leading-relaxed text-brown">
            {copy.body ?? pageCopy.visit.body}
          </p>

          <div className="mt-10">
            {locations.map((location) => (
              <LocationCard
                key={location.id}
                location={location}
                priority
                showName={locations.length > 1}
              />
            ))}
          </div>

          {site.hours.provisional ? (
            <p className="measure mt-8 text-[0.875rem] leading-relaxed text-brown">
              Kitchen and bar hours can shift on holidays and event nights — call ahead if you are
              making a special trip.
            </p>
          ) : null}
        </Frame>
      </Band>

      <Band surface="cream">
        <Frame wide>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-5">
              <Eyebrow>Book a table</Eyebrow>
              <h2 className="display mt-4 text-[clamp(1.5rem,2.4vw,1.875rem)] text-brown">
                Reserve, or take it with you.
              </h2>
              <div className="mt-6 flex flex-wrap gap-3">
                <ExternalButtonLink href={site.reservationUrl} destination="Demo ordering reservations">
                  Reserve a table
                </ExternalButtonLink>
                <ExternalButtonLink
                  href={site.orderUrl}
                  destination="Demo ordering ordering"
                  variant="secondary"
                >
                  Order online
                </ExternalButtonLink>
              </div>
            </div>

            <div className="lg:col-span-3 lg:col-start-7">
              <Eyebrow>Getting here</Eyebrow>
              <address className="mt-6 not-italic leading-relaxed text-brown">
                <span className="block font-medium">{site.name}</span>
                <span className="block">{site.street}</span>
                <span className="block">
                  {site.locality}, {site.region} {site.postalCode}
                </span>
              </address>
              <div className="mt-4 flex flex-col gap-2 text-[0.9375rem]">
                <ExternalTextLink
                  href={site.directionsUrl}
                  destination="Google Maps"
                  className="text-brown"
                >
                  Open in Google Maps
                </ExternalTextLink>
              </div>
            </div>

            <div className="lg:col-span-3 lg:col-start-10">
              <Eyebrow>Follow</Eyebrow>
              <ul className="mt-6 space-y-2 text-[0.9375rem]">
                {site.socials.map((social) => (
                  <li key={social.platform}>
                    <ExternalTextLink
                      href={social.url}
                      destination={social.platform}
                      className="text-brown"
                    >
                      {social.handle}
                    </ExternalTextLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Frame>
      </Band>

      {/* The room, before you arrive. */}
      <Band surface="ivory-deep" size="sm">
        <Frame wide>
          <Eyebrow>The room</Eyebrow>
          <div className="relative mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            <ThemePhotoGuest name="supper-guests" />
            <Asset
              id="diningRoom"
              className="aspect-3/4 w-full"
              sizes="(min-width: 640px) 30vw, 50vw"
            />
            <Asset
              id="backBar"
              className="aspect-3/4 w-full"
              sizes="(min-width: 640px) 30vw, 50vw"
            />
            <Asset
              id="cocktailPair"
              className="col-span-2 aspect-3/2 w-full sm:col-span-1 sm:aspect-3/4"
              sizes="(min-width: 640px) 30vw, 100vw"
            />
          </div>
        </Frame>
      </Band>

      <MoreWays current="visit" />
      <ThemeWorld scene="welcome" />
    </>
  );
}
