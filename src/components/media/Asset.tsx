import Image from 'next/image';
import { getPublicAsset, ratioOf, type PublicAsset } from '@/content/media';
import { Placeholder } from './Placeholder';

interface AssetProps {
  id: string;
  /** Wrapper classes. Aspect ratio comes from the record, not from here. */
  className?: string;
  /** Responsive sizes hint. Always pass one for non-fixed placements. */
  sizes?: string;
  priority?: boolean;
  /** Overrides the record's alt text where context makes it more useful. */
  alt?: string;
  rounded?: boolean;
  /** Keeps a missing-asset placeholder inside the surrounding surface's ramp. */
  tone?: 'light' | 'dark';
  /**
   * `contain` shows the WHOLE image inside the frame. Required for artwork whose
   * edges carry information — an event flyer cropped to a landscape card loses
   * its address and age line.
   */
  fit?: 'cover' | 'contain';
}

/**
 * The only way a photograph enters a page.
 *
 * Components request a semantic ID; they never see a file path. Everything else
 * — the file, aspect ratio, focal point, alt text, dimensions — comes from the
 * media record, which is the registry in `src/content/assets.ts` with whatever
 * the admin has published laid over the top. Swapping a photograph in Photos
 * therefore changes the website, and a clean checkout with no database renders
 * exactly what it always did.
 *
 * If the record has no file, this renders the branded placeholder at the
 * identical geometry, so layout never depends on whether the photo exists.
 */
export async function Asset({
  id,
  className = '',
  sizes = '100vw',
  priority = false,
  alt,
  rounded = true,
  tone = 'light',
  fit = 'cover',
}: AssetProps) {
  const asset = await getPublicAsset(id);
  return (
    <AssetView
      asset={asset}
      id={id}
      className={className}
      sizes={sizes}
      priority={priority}
      alt={alt}
      rounded={rounded}
      tone={tone}
      fit={fit}
    />
  );
}

/**
 * The same rendering, from an already-resolved record.
 *
 * Used where the caller has the record in hand — the admin, which shows one
 * photograph per row and would otherwise re-resolve the whole map each time.
 */
export function AssetView({
  asset,
  id,
  className = '',
  sizes = '100vw',
  priority = false,
  alt,
  rounded = true,
  tone = 'light',
  fit = 'cover',
}: AssetProps & { asset: PublicAsset | null }) {
  const radius = rounded ? 'rounded-(--radius-lg)' : '';

  // An unknown ID is a programming error, but it must not take a whole page
  // down in production — render nothing and let the checker catch it in CI.
  if (!asset) {
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(`Unknown asset id: "${id}". Add it to src/content/assets.ts.`);
    }
    return null;
  }

  if (!asset.path) {
    return <Placeholder asset={asset} id={id} className={`${radius} ${className}`} tone={tone} />;
  }

  const decorative = asset.alt === null && !alt;

  return (
    <div
      className={`relative overflow-hidden ${radius} ${className}`}
      // The record's ratio is the default. A caller that sets its own height
      // (`size-full`, `h-full`, `aspect-*`) overrides it, so a background layer
      // is not forced to the asset's intrinsic shape.
      style={
        /\b(size-full|h-full|aspect-)/.test(className) ? undefined : { aspectRatio: ratioOf(asset) }
      }
    >
      <Image
        src={asset.path}
        alt={decorative ? '' : (alt ?? asset.alt ?? '')}
        aria-hidden={decorative || undefined}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : 'lazy'}
        className={fit === 'contain' ? 'object-contain' : 'object-cover'}
        // A contained image is centred in its frame; a focal point only means
        // something when the frame is cropping.
        style={fit === 'contain' ? undefined : { objectPosition: asset.focal }}
      />
    </div>
  );
}
