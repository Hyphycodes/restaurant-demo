import { Button } from '@react-email/components';
import type { ReactNode } from 'react';
import { COLORS, FONTS, RADIUS, type Surface } from '../theme';

/**
 * The one button. Amber on the dark surface, coral on the light one — the
 * same rule the website follows — and 48px tall so a thumb finds it. A
 * `secondary` variant exists for the second action on a page ("Directions"),
 * drawn as an outline so it never competes.
 */
export function PrimaryButton({
  href,
  children,
  surface,
  variant = 'primary',
  block = false,
}: {
  href: string;
  children: ReactNode;
  surface: Surface;
  variant?: 'primary' | 'secondary';
  block?: boolean;
}) {
  const fill = surface === 'dark' ? COLORS.amber : COLORS.coral;
  const primary = { backgroundColor: fill, color: COLORS.onOrange, border: `2px solid ${fill}` };
  const secondary = {
    backgroundColor: 'transparent',
    color: surface === 'dark' ? COLORS.nightText : COLORS.brown,
    border: `2px solid ${surface === 'dark' ? '#4a3620' : '#d8c4a4'}`,
  };
  return (
    <Button
      href={href}
      style={{
        ...(variant === 'primary' ? primary : secondary),
        display: block ? 'block' : 'inline-block',
        boxSizing: 'border-box',
        width: block ? '100%' : undefined,
        borderRadius: RADIUS.md,
        padding: '14px 26px',
        fontFamily: FONTS.sans,
        fontSize: 16,
        lineHeight: '20px',
        fontWeight: 700,
        textAlign: 'center',
        textDecoration: 'none',
      }}
    >
      {children}
    </Button>
  );
}
