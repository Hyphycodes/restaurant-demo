import { AssetView } from '@/components/media/Asset';
import { getPublicAsset } from '@/content/media';

/**
 * Series or occurrence flyer.
 *
 * The restaurant's own artwork, shown whole. Two rules make it safe to publish:
 *
 *  1. `object-contain` inside a stable square frame, so nothing is cropped away —
 *     an event flyer squeezed into a landscape card loses the address, the age
 *     line and the times printed along its edges.
 *  2. A date printed INTO the pixels is captioned as what it is. The authoritative
 *     next date is rendered as live HTML text beside it, from a generated
 *     occurrence, so a visitor is never left to reconcile two dates on their own.
 *     See PLAN.md §4.1.
 *
 * With no approved flyer the frame still reserves its square and says current
 * artwork is pending, rather than collapsing the layout.
 */
export async function Flyer({
  assetId,
  printedDate,
  eventName,
  tone,
  sizes = '(min-width: 1024px) 30vw, 90vw',
  priority = false,
}: {
  assetId: string | null;
  /** The date printed into the artwork, when there is one. */
  printedDate: string | null;
  /** Used in the caption: "Fridays runs every week". */
  eventName: string;
  tone: 'teal' | 'plum';
  sizes?: string;
  priority?: boolean;
}) {
  const frame =
    tone === 'teal' ? 'border-amber/30 bg-teal-lift/60' : 'border-coral-light/30 bg-plum-lift/60';
  const caption = tone === 'teal' ? 'text-teal-soft' : 'text-plum-soft';

  // Resolved through the media store, so the flyer a guest sees is the same
  // record the admin edits — including a photograph swapped for one night only.
  const asset = assetId ? await getPublicAsset(assetId) : null;

  return (
    <figure>
      <div className={`overflow-hidden rounded-(--radius-lg) border ${frame} p-2.5 sm:p-3`}>
        {asset?.path ? (
          <AssetView
            asset={asset}
            id={assetId!}
            className="aspect-square w-full"
            sizes={sizes}
            priority={priority}
            fit="contain"
            rounded={false}
            tone="dark"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center px-6 text-center">
            <p className={`text-[0.875rem] leading-relaxed ${caption}`}>
              Current artwork for {eventName} is on the way. The date, time and entry details on this page
              are live.
            </p>
          </div>
        )}
      </div>

      {/* Deliberately not "the next date is above/below": the flyer sits beside
          the details on wide screens and above them on narrow ones, so the
          caption has to be true at every width. */}
      {printedDate ? (
        <figcaption className={`mt-2.5 text-[0.8125rem] leading-relaxed ${caption}`}>
          Series artwork, printed for {printedDate}. {eventName} runs every week — the next date and
          entry details are listed on this page.
        </figcaption>
      ) : null}
    </figure>
  );
}
