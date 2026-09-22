import type { ElementType, ReactNode } from 'react';

export function Eyebrow({
  children,
  tone = 'default',
  className = '',
}: {
  children: ReactNode;
  tone?: 'default' | 'orange' | 'night';
  className?: string;
}) {
  const color =
    tone === 'orange' ? 'text-clay' : tone === 'night' ? 'text-night-soft' : 'text-brown-soft';
  return <p className={`eyebrow ${color} ${className}`}>{children}</p>;
}

interface DisplayProps {
  children: ReactNode;
  as?: ElementType;
  size?: 'xl' | 'lg' | 'md';
  className?: string;
  id?: string;
}

/**
 * Display type carries the variable width axis — this is where the typography
 * does actual work rather than being body copy scaled up.
 * See docs/DESIGN-DIRECTION.md §2.3.
 */
export function Display({
  children,
  as: Tag = 'h2',
  size = 'lg',
  className = '',
  id,
}: DisplayProps) {
  const sizing = {
    xl: 'text-[clamp(2.25rem,5.5vw,3.75rem)]',
    lg: 'text-[clamp(1.875rem,3.6vw,2.75rem)]',
    md: 'text-[clamp(1.5rem,2.4vw,1.875rem)]',
  }[size];

  // `display` supplies the Anton voice, uppercase, and its tighter leading.
  return (
    <Tag id={id} className={`display ${sizing} ${className}`}>
      {children}
    </Tag>
  );
}

export function Lead({
  children,
  tone = 'default',
  className = '',
}: {
  children: ReactNode;
  tone?: 'default' | 'night';
  className?: string;
}) {
  return (
    <p
      className={`measure-lead text-[length:var(--text-body-lg)] leading-relaxed ${
        tone === 'night' ? 'text-night-soft' : 'text-brown-soft'
      } ${className}`}
    >
      {children}
    </p>
  );
}
