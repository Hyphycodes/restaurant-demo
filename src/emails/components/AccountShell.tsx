import { Text } from '@react-email/components';
import type { ReactNode } from 'react';
import { FONTS, GUTTER, PALETTE } from '../theme';
import type { EmailBrand } from '../types';
import { NoticeBox } from './NoticeBox';
import { RestaurantEmailLayout } from './RestaurantEmailLayout';
import { RestaurantHeader } from './RestaurantHeader';
import { PrimaryButton } from './PrimaryButton';
import { Block } from './Block';

/**
 * The shape every account and staff email shares: a headline, a sentence
 * or two, one button, the same link as text for a client that strips
 * buttons, and a security line. Ivory, because these are letters, not
 * tickets.
 */
export function AccountShell({
  brand,
  preview,
  eyebrow,
  headline,
  greeting,
  actionUrl,
  actionLabel,
  test,
  security,
  footerReason,
  children,
}: {
  brand: EmailBrand;
  preview: string;
  eyebrow: string;
  headline: string;
  greeting: string | null;
  actionUrl: string;
  actionLabel: string;
  test?: boolean;
  /** "This link works once and expires in 24 hours." */
  security: string;
  footerReason: string;
  children: ReactNode;
}) {
  const surface = 'light';
  const palette = PALETTE.light;
  const body = { margin: 0, fontFamily: FONTS.sans, fontSize: 16, lineHeight: '24px', color: palette.text } as const;
  return (
    <RestaurantEmailLayout preview={preview} surface={surface} brand={brand} test={test} footerReason={footerReason}>
      <RestaurantHeader brand={brand} surface={surface} eyebrow={eyebrow} />
      <Block className="o-gutter" style={{ padding: `8px ${GUTTER}px 4px` }}>
        {greeting ? <Text style={{ ...body, color: palette.muted }}>{greeting}</Text> : null}
        <Text style={{ margin: '8px 0 0', fontFamily: FONTS.sans, fontSize: 32, lineHeight: '36px', fontWeight: 800, color: palette.text }}>{headline}</Text>
      </Block>
      <Block className="o-gutter" style={{ padding: `14px ${GUTTER}px 4px` }}>{children}</Block>
      <Block className="o-gutter" style={{ padding: `18px ${GUTTER}px 8px` }}>
        <PrimaryButton href={actionUrl} surface={surface} block>
          {actionLabel}
        </PrimaryButton>
        <Text style={{ ...body, marginTop: 14, fontSize: 13, lineHeight: '19px', color: palette.muted, wordBreak: 'break-all' }}>
          If the button does not work, open this link: {actionUrl}
        </Text>
      </Block>
      <Block className="o-gutter" style={{ padding: `8px ${GUTTER}px 16px` }}>
        <NoticeBox tone="info" surface={surface}>
          {security}
        </NoticeBox>
      </Block>
    </RestaurantEmailLayout>
  );
}

export const accountBody = { margin: 0, fontFamily: FONTS.sans, fontSize: 16, lineHeight: '24px', color: PALETTE.light.text } as const;
