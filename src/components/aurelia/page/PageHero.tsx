import type { ReactNode } from 'react';
import { Asset } from '@/components/media/Asset';
import { MotionScope } from '../motion/MotionScope';

/**
 * The opening of every interior page: a photograph brought up out of the
 * dark, an eyebrow, a title set like a film card, and whatever the page needs
 * a guest to do first.
 */
export function PageHero({
  eyebrow,
  title,
  lede,
  asset,
  assetTall,
  aside,
  children,
  compact = false,
  focus,
  dim = false,
}: {
  /** Heavier shade, for bright photographs. */
  dim?: boolean;
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  asset?: string;
  assetTall?: string;
  aside?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
  /** Where the candle glow sits, as CSS percentages. */
  focus?: { x: string; y: string };
}) {
  return (
    <MotionScope
      as="section"
      className={`cn-page-hero cn-grain ${!asset ? 'cn-page-hero-compact' : compact ? 'cn-page-hero-short' : ''} ${dim ? 'cn-page-hero-dim' : ''}`}
      aria-label={eyebrow}
    >
      {asset ? (
        <div className="cn-page-hero-media" aria-hidden="true">
          <div data-m="parallax" data-speed="0.25" className="absolute inset-0">
            <Asset id={asset} rounded={false} priority sizes="100vw" className={assetTall ? 'cn-hero-wide size-full' : 'size-full'} alt="" />
            {assetTall ? <Asset id={assetTall} rounded={false} priority sizes="100vw" className="cn-hero-tall size-full" alt="" /> : null}
          </div>
        </div>
      ) : null}
      {asset ? (
        <span
          className="cn-candles"
          aria-hidden="true"
          style={focus ? { ['--cx1' as string]: focus.x, ['--cy1' as string]: focus.y } : undefined}
        />
      ) : (
        <span className="cn-page-hero-glow" aria-hidden="true" />
      )}
      <div className="cn-wrap relative z-[4]">
        <div className="cn-page-hero-grid">
          <div>
            <p className="cn-eyebrow" data-m="up" data-now>
              {eyebrow}
            </p>
            <h1 className="cn-display cn-xl mt-5" data-m="title" data-now data-delay="0.15">
              {title}
            </h1>
          </div>
          {lede || aside ? (
            <div className="cn-page-hero-aside" data-m="up" data-now data-delay="0.5">
              {lede ? <p className="cn-lede">{lede}</p> : null}
              {aside}
            </div>
          ) : null}
        </div>
        {children ? (
          <div className="mt-10" data-m="up" data-now data-delay="0.7">
            {children}
          </div>
        ) : null}
      </div>
    </MotionScope>
  );
}
