import { Link } from '@react-email/components';
import type { ReactNode } from 'react';
import { FONTS, PALETTE, type Surface } from '../theme';

/**
 * A label and a value, side by side. Used in threes and fours: when, where,
 * doors, age. The label is small caps so the value is what the eye lands on.
 */
export function InfoRow({
  label,
  children,
  surface,
  href,
  last = false,
}: {
  label: string;
  children: ReactNode;
  surface: Surface;
  href?: string;
  last?: boolean;
}) {
  const palette = PALETTE[surface];
  return (
    <tr>
      <td
        style={{
          width: 84,
          padding: '9px 12px 9px 0',
          verticalAlign: 'top',
          borderBottom: last ? 'none' : `1px solid ${palette.line}`,
          fontFamily: FONTS.sans,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          lineHeight: '20px',
          color: palette.muted,
        }}
      >
        {label}
      </td>
      <td
        style={{
          padding: '9px 0',
          verticalAlign: 'top',
          borderBottom: last ? 'none' : `1px solid ${palette.line}`,
          fontFamily: FONTS.sans,
          fontSize: 15,
          lineHeight: '20px',
          color: palette.text,
        }}
      >
        {href ? (
          <Link href={href} style={{ color: palette.text, textDecoration: 'underline', textDecorationColor: palette.accent }}>
            {children}
          </Link>
        ) : (
          children
        )}
      </td>
    </tr>
  );
}

/** The table that `InfoRow`s live in. */
export function InfoTable({ children }: { children: ReactNode }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
      <tbody>{children}</tbody>
    </table>
  );
}
