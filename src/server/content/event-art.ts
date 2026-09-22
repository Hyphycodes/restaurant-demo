import 'server-only';

import flyers from '@/content/imported-flyers.json';
import type { EventArtwork } from '@/components/events/EventArt';
import { defaultEventArt, defaultEventFlyer } from '@/content/event-art-defaults';
import { getMediaMap, type PublicAsset } from '@/content/media';
import type { ResolvedEvent } from '@/content/types';

/**
 * An event's four artwork slots, resolved to real files.
 *
 * One media lookup for a whole page — the map is request-cached, so a homepage
 * showing three events and a page showing twenty both cost one query.
 *
 * A slot whose asset was archived or never existed comes back null, and the
 * composition handles that: an event with nothing but its flyer still renders,
 * and an event with nothing at all still renders as its own lit colour field.
 */
/** Exact provider ID matching prevents same-title nights using one another's flyer. */
function importedFlyer(event: ResolvedEvent): PublicAsset | null {
  const id = event.provenance.sourceEventId;
  if (!id) return null;
  const flyer = (flyers as Record<string, {path: string; width: number; height: number; startsAt: string}>)[id];
  // Do not show dated artwork after staff reschedule a night.
  if (!flyer || Date.parse(flyer.startsAt) !== Date.parse(event.startsAt)) return null;
  return { ...flyer, kind: 'image', alt: `Official flyer for ${event.title}`, ratio: `${flyer.width}:${flyer.height}`, focal: '50% 50%', status: 'final' };
}

export async function resolveEventArtwork(event: ResolvedEvent): Promise<EventArtwork> {
  const media = await getMediaMap();
  const pick = (id: string | null): PublicAsset | null => {
    if (!id) return null;
    const asset = media[id];
    return asset?.path ? asset : null;
  };

  const shipped = defaultEventArt(event.slug);
  return {
    // The official flyer, first and always available. An uploaded or imported
    // flyer wins; a flyer that ships in the repo only ever fills an empty slot.
    flyer: pick(event.flyerAssetId) ?? importedFlyer(event) ?? defaultEventFlyer(event.slug, event.title),
    // An uploaded background wins; otherwise the shipped one; otherwise none,
    // and the composition falls back to showing the flyer large.
    keyArt: pick(event.presentation.keyArtAssetId) ?? shipped?.wide ?? null,
    keyArtMobile: pick(event.presentation.keyArtMobileAssetId) ?? shipped?.tall ?? null,
    foreground: pick(event.presentation.foregroundAssetId),
  };
}

/** The same, for a list, without re-reading the map per event. */
export async function resolveManyEventArtwork(
  events: ResolvedEvent[],
): Promise<Map<string, EventArtwork>> {
  const media = await getMediaMap();
  const pick = (id: string | null): PublicAsset | null => {
    if (!id) return null;
    const asset = media[id];
    return asset?.path ? asset : null;
  };

  return new Map(
    events.map((event) => {
      const shipped = defaultEventArt(event.slug);
      return [
        event.id,
        {
          flyer: pick(event.flyerAssetId) ?? importedFlyer(event) ?? defaultEventFlyer(event.slug, event.title),
          keyArt: pick(event.presentation.keyArtAssetId) ?? shipped?.wide ?? null,
          keyArtMobile: pick(event.presentation.keyArtMobileAssetId) ?? shipped?.tall ?? null,
          foreground: pick(event.presentation.foregroundAssetId),
        },
      ];
    }),
  );
}
