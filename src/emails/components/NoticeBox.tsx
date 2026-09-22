import { Text } from '@react-email/components';
import type { ReactNode } from 'react';
import { COLORS, FONTS, PALETTE, RADIUS, type Surface } from '../theme';
import { Block } from './Block';

/**
 * A boxed sentence or two. Three tones, each with a word in it, so the
 * meaning does not depend on colour: `info` for arrival notes, `warning`
 * for "the time has changed", `danger` for a cancellation, `success` for
 * "your refund is done".
 */
export function NoticeBox({
  tone = 'info',
  title,
  surface,
  children,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  title?: string;
  surface: Surface;
  children: ReactNode;
}) {
  const palette = PALETTE[surface];
  const dark = surface === 'dark';
  const styles = {
    info: { background: palette.raised, border: palette.line, title: palette.accent },
    warning: { background: dark ? '#3a2408' : '#fbeccf', border: COLORS.amber, title: dark ? COLORS.amberBright : COLORS.clay },
    danger: { background: dark ? '#3a1410' : COLORS.dangerSoft, border: COLORS.coral, title: dark ? '#ff9a7e' : COLORS.danger },
    success: { background: dark ? '#14301b' : COLORS.successSoft, border: dark ? '#3f7a49' : COLORS.success, title: dark ? '#9fd3a6' : COLORS.success },
  }[tone];
  return (
    <Block style={{ backgroundColor: styles.background, borderLeft: `4px solid ${styles.border}`, borderRadius: RADIUS.sm, padding: '14px 16px' }}>
      {title ? (
        <Text style={{ margin: '0 0 4px', fontFamily: FONTS.sans, fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: styles.title }}>
          {title}
        </Text>
      ) : null}
      <Text style={{ margin: 0, fontFamily: FONTS.sans, fontSize: 15, lineHeight: '22px', color: palette.text }}>{children}</Text>
    </Block>
  );
}
