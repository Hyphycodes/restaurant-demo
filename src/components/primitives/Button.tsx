import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'on-dark';
type Size = 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-(--radius-md) font-semibold ' +
  '[font-variation-settings:"wdth"_104] tracking-[0.02em] transition-colors duration-150 ' +
  'active:translate-y-px disabled:pointer-events-none disabled:opacity-50 ' +
  // 44px minimum touch target at every size.
  'min-h-11';

const VARIANT: Record<Variant, string> = {
  // Label is near-black, not cream: cream on orange is only 3.31:1.
  primary: 'bg-orange text-on-orange hover:bg-orange-deep',
  secondary: 'border border-brown/25 bg-transparent text-brown hover:bg-brown/8',
  ghost: 'text-clay underline underline-offset-4 hover:text-orange-deep hover:underline-offset-[6px]',
  'on-dark': 'border border-night-text/30 bg-transparent text-night-text hover:bg-night-text/10',
};

const SIZE: Record<Size, string> = {
  md: 'px-5 py-2.5 text-[0.9375rem]',
  lg: 'px-7 py-3.5 text-base',
};

interface Props {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...rest
}: Props & ComponentProps<'button'>) {
  return (
    <button
      className={`${BASE} ${VARIANT[variant]} ${variant === 'ghost' ? '' : SIZE[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  href,
  variant = 'primary',
  size = 'md',
  className = '',
  ...rest
}: Props & { href: string } & Omit<ComponentProps<typeof Link>, 'href' | 'className'>) {
  return (
    <Link
      href={href}
      className={`${BASE} ${VARIANT[variant]} ${variant === 'ghost' ? '' : SIZE[size]} ${className}`}
      {...rest}
    >
      {children}
    </Link>
  );
}

function ExternalIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 2.5H3.5A1.5 1.5 0 0 0 2 4v8.5A1.5 1.5 0 0 0 3.5 14H12a1.5 1.5 0 0 0 1.5-1.5V10" />
      <path d="M9.5 2.5H13.5V6.5" />
      <path d="M13.5 2.5 7.5 8.5" />
    </svg>
  );
}

/**
 * Every off-site destination is labelled as one — Demo ordering reservations, Demo ordering
 * ordering, ticketing, maps. `destination` names where the guest is going, so
 * "opens Demo ordering" is stated rather than discovered.
 */
export function ExternalButtonLink({
  children,
  href,
  destination,
  variant = 'primary',
  size = 'md',
  className = '',
}: Props & { href: string; destination: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`}
    >
      {children}
      <ExternalIcon />
      <span className="sr-only">(opens {destination} in a new tab)</span>
    </a>
  );
}

export function ExternalTextLink({
  children,
  href,
  destination,
  className = '',
}: {
  children: ReactNode;
  href: string;
  destination: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      // min-h-11 keeps this a 44px touch target even though it reads as body text.
      className={`inline-flex min-h-11 items-center gap-1.5 underline underline-offset-4 transition-[text-underline-offset] duration-150 hover:underline-offset-[6px] ${className}`}
    >
      {children}
      <ExternalIcon />
      <span className="sr-only">(opens {destination} in a new tab)</span>
    </a>
  );
}
