import type { ReactNode } from 'react';

type Surface = 'ivory' | 'ivory-deep' | 'cream' | 'linen' | 'sand' | 'teal' | 'plum' | 'espresso';

const SURFACE: Record<Surface, string> = {
  ivory: 'bg-ivory text-brown',
  'ivory-deep': 'bg-ivory-deep text-brown',
  cream: 'bg-cream text-brown',
  linen: 'bg-linen text-brown',
  sand: 'bg-sand text-brown grain on-sand',
  // Evening surfaces. teal = restaurant-and-bar atmosphere (Friday leans here),
  // plum = warmer and later (Saturday evening leans here).
  teal: 'bg-teal text-night-text on-dark',
  plum: 'bg-plum text-night-text on-dark',
  espresso: 'bg-espresso text-night-text on-dark',
};

interface BandProps {
  children: ReactNode;
  surface?: Surface;
  /** Vertical rhythm. `flush` is for bands whose child supplies its own padding. */
  size?: 'default' | 'sm' | 'flush';
  
  topRule?: boolean;
  id?: string;
  as?: 'section' | 'div' | 'footer' | 'header';
  className?: string;
}

/**
 * A full-bleed color band. Sections are color fields, not rounded cards —
 * this is the structural rule that keeps the site from reading as a template.
 */
export function Band({
  children,
  surface = 'cream',
  size = 'default',
  topRule = false,
  id,
  as: Tag = 'section',
  className = '',
}: BandProps) {
  const padding =
    size === 'flush' ? '' : size === 'sm' ? 'py-(--spacing-band-sm)' : 'py-(--spacing-band)';

  return (
    <Tag
      id={id}
      // `o-band` is a stable hook, not a style. It marks a FULL-BLEED surface,
      // which is the only thing a seasonal theme may dissolve into a pool of
      // light — a colour token alone cannot be trusted for that, because the
      // same token also fills small solid things (menu chips, category tiles)
      // that must keep a real surface.
      className={`o-band relative isolate ${SURFACE[surface]} ${padding} ${
        topRule ? 'border-t-2 border-t-orange' : ''
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

/** Horizontal page frame. 1440 max, generous edge gutters at every width. */
export function Frame({
  children,
  wide = false,
  className = '',
}: {
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative mx-auto w-full px-5 sm:px-8 lg:px-12 ${
        wide ? 'max-w-[1440px]' : 'max-w-[1120px]'
      } ${className}`}
    >
      {children}
    </div>
  );
}
