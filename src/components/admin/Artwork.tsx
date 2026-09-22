import { AssetView } from '@/components/media/Asset';
import type { PublicAsset } from '@/content/media';

/**
 * An event's artwork, as a picture.
 *
 * The admin used to print the words "Artwork set" beside every night, which told
 * a person that a value existed and nothing about whether it was the right one.
 * Two Friday flyers and a Saturday flyer are only distinguishable by looking at
 * them, so the list shows them.
 *
 * `source` is the other half: a flyer inherited from the series and a flyer
 * chosen for one night look identical, and confusing them is how somebody
 * changes twenty nights meaning to change one.
 */
export type ArtworkSource = 'series' | 'occurrence' | 'none';

export const ARTWORK_LABEL: Record<ArtworkSource, string> = {
  series: 'Series artwork',
  occurrence: "This night's artwork",
  none: 'Needs artwork',
};

export function ArtworkThumb({
  asset,
  size = 'sm',
}: {
  asset: PublicAsset | null;
  size?: 'sm' | 'lg';
}) {
  const box = size === 'lg' ? 'size-32 sm:size-40' : 'size-12';

  if (!asset?.path) {
    return (
      <div
        className={`${box} shrink-0 rounded-(--radius-sm) border border-dashed border-warning/60 bg-ivory-deep`}
        aria-hidden="true"
      />
    );
  }

  return (
    <AssetView
      asset={asset}
      id="artwork"
      // Contained, not cropped: a flyer squeezed into a square loses the edges,
      // and the edges are where the date and the address are printed.
      fit="contain"
      rounded={false}
      alt=""
      sizes={size === 'lg' ? '160px' : '48px'}
      className={`${box} shrink-0 rounded-(--radius-sm) border border-brown/15 bg-espresso`}
    />
  );
}

/** The label under a thumbnail. Never colour alone — the words carry it. */
export function ArtworkSourceNote({
  source,
  className = '',
}: {
  source: ArtworkSource;
  className?: string;
}) {
  const tone =
    source === 'none'
      ? 'text-warning'
      : source === 'occurrence'
        ? 'text-clay'
        : 'text-brown-soft';
  return (
    <span className={`text-[0.75rem] font-medium ${tone} ${className}`}>
      {ARTWORK_LABEL[source]}
    </span>
  );
}

/** Where a night's flyer came from, from the resolved event. */
export function artworkSourceOf(event: {
  flyerAssetId: string | null;
  overriddenFields: string[];
}): ArtworkSource {
  if (!event.flyerAssetId) return 'none';
  return event.overriddenFields.includes('flyerAssetId') ? 'occurrence' : 'series';
}
