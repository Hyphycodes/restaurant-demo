import { AssetView } from '@/components/media/Asset';
import { PRESET_STYLE, type VisualPreset } from '@/content/event-presentation';
import type { PublicAsset } from '@/content/media';
import type { CSSProperties } from 'react';

/**
 * An event's artwork, composed.
 *
 * THE FLYER IS THE ARTWORK. When an event has one it is the subject of the
 * composition — large, centred and whole — and the generated key art drops
 * behind it, blurred, as nothing more than atmosphere in the event's own
 * colour. That is the right way round: the flyer is what the restaurant
 * actually promotes the night with, and a guest recognises it. The key art is
 * ours, and it is scenery.
 *
 * Three arrangements, in priority order:
 *
 *   flyer            the flyer, contained and complete, over an ambient wash
 *                    of its own key art (blurred) or its preset colour.
 *   key art only     the cinematic frame carries the card by itself.
 *   nothing          the event's name, set as poster type on its own colour.
 *
 * `object-contain` for the flyer, always and everywhere. A flyer prints its own
 * name, date, price and age line along its edges, and cropping it throws those
 * away.
 */

export interface EventArtwork {
  flyer: PublicAsset | null;
  /** Shipped art carries a `srcSet`; art uploaded through the admin does not. */
  keyArt: (PublicAsset & { srcSet?: string }) | null;
  keyArtMobile: (PublicAsset & { srcSet?: string }) | null;
  foreground: PublicAsset | null;
}

/** The CSS custom properties an event's preset contributes. */
export function presetVars(preset: VisualPreset): CSSProperties {
  const style = PRESET_STYLE[preset];
  return {
    '--e-accent': style.accent,
    '--e-surface': style.surface,
    '--e-glow': style.glow,
  } as CSSProperties;
}

export function EventArt({
  art,
  title,
  preset,
  /** `lead` is the dominant slot; `card` is everything else. */
  size = 'card',
  sizes,
  priority = false,
  className = '',
  fill = false,
  uprightMedia = '(max-width: 639px)',
}: {
  art: EventArtwork;
  title: string;
  preset: VisualPreset;
  size?: 'lead' | 'card';
  sizes?: string;
  priority?: boolean;
  className?: string;
  /** Drop the fixed ratio and fill the height the parent gives us. */
  fill?: boolean;
  /**
   * When to use the upright crop of the KEY ART. Defaults to phones. A frame
   * that is upright on a wide screen too passes its own query; it cannot be
   * inferred from `fill`, because a full-width banner also fills and is
   * emphatically landscape.
   */
  uprightMedia?: string;
}) {
  const hasKeyArt = Boolean(art.keyArt?.path);
  const hasFlyer = Boolean(art.flyer?.path);
  const wide = art.keyArt;
  const resolvedSizes =
    sizes ?? (size === 'lead' ? '(min-width: 1024px) 62vw, 100vw' : '(min-width: 1024px) 30vw, 90vw');

  // What the frame is actually about. The stylesheet reads this to decide the
  // aspect ratio, whether the backdrop is blurred, and how much room the flyer
  // gets — one attribute rather than a pile of conditional class names.
  const subject = hasFlyer ? 'flyer' : hasKeyArt ? 'keyart' : 'none';

  return (
    <div
      className={`event-art ${fill ? 'event-art-fill' : ''} ${className}`}
      style={presetVars(preset)}
      data-size={size}
      data-subject={subject}
    >
      {/* The lit field. Present in every arrangement, so an event with no
          artwork at all still reads as a designed object rather than a gap. */}
      <span aria-hidden="true" className="event-art-field" />

      {hasKeyArt && wide?.path ? (
        <>
          {/* A plain <picture>, not next/image: these are decorative
              backgrounds already shipped at their final size, and <picture> is
              the only way to art-direct a different CROP without downloading
              both files. */}
          <picture className="event-art-bg">
            {art.keyArtMobile?.path ? (
              <source
                media={uprightMedia}
                srcSet={art.keyArtMobile.srcSet ?? art.keyArtMobile.path}
                sizes={art.keyArtMobile.srcSet ? resolvedSizes : undefined}
              />
            ) : null}
            <img
              src={wide.path}
              srcSet={wide.srcSet}
              sizes={wide.srcSet ? resolvedSizes : undefined}
              alt=""
              width={wide.width || undefined}
              height={wide.height || undefined}
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : 'low'}
              decoding="async"
            />
          </picture>
          <span aria-hidden="true" className="event-art-scrim" />
        </>
      ) : null}

      {hasFlyer && art.flyer ? (
        <figure className="event-art-official">
          <AssetView
            asset={art.flyer}
            id="event-flyer"
            // Contained, never cropped — the flyer's edges carry its own text.
            fit="contain"
            rounded={false}
            tone="dark"
            sizes={resolvedSizes}
            priority={priority}
            alt={`Official flyer for ${title}`}
            className="event-art-flyer-img"
          />
        </figure>
      ) : null}

      {/* Nothing at all: the event's own name, set as poster type on its own
          colour. An event awaiting artwork should look like a designed placard,
          not a hole — and the name is information, so it belongs in the DOM
          rather than in a picture anyway. */}
      {subject === 'none' ? (
        <span className="event-art-nameplate" aria-hidden="true">
          <span className="display-poster">{title}</span>
        </span>
      ) : null}

      {art.foreground?.path ? (
        <AssetView
          asset={art.foreground}
          id="event-foreground"
          fit="contain"
          rounded={false}
          tone="dark"
          sizes="(min-width: 1024px) 22vw, 45vw"
          alt=""
          className="event-art-foreground"
        />
      ) : null}
    </div>
  );
}
