import { Hr, Link, Text } from '@react-email/components';
import { FONTS, GUTTER, PALETTE, type Surface } from '../theme';
import type { EmailBrand } from '../types';
import { Block } from './Block';

/**
 * The footer: who sent this, where they are, how to reach them.
 *
 * Deliberately short. The address is here because a guest forwards the
 * email to a friend who has never been; the phone because a problem at
 * 6:55pm needs a human, not a help centre.
 */
export function RestaurantFooter({ brand, surface, reason }: { brand: EmailBrand; surface: Surface; reason?: string }) {
  const palette = PALETTE[surface];
  const small = { margin: 0, fontFamily: FONTS.sans, fontSize: 12, lineHeight: '18px', color: palette.muted } as const;
  const link = { color: palette.muted, textDecoration: 'underline' } as const;
  return (
    <Block className="o-gutter" style={{ padding: `8px ${GUTTER}px 28px` }}>
      <Hr style={{ borderColor: palette.line, borderTop: `1px solid ${palette.line}`, margin: '0 0 18px' }} />
      <Text style={{ ...small, fontWeight: 700, color: palette.text }}>{brand.name}</Text>
      <Text style={small}>
        West Loop, Chicago, IL  · <Link href={`tel:+1${brand.phone.replace(/\D/g, '')}`} style={link}>{brand.phone}</Link>
        {brand.supportEmail ? (
          <>
            {' '}· <Link href={`mailto:${brand.supportEmail}`} style={link}>{brand.supportEmail}</Link>
          </>
        ) : null}
      </Text>
      <Text style={{ ...small, marginTop: 10 }}>
        <Link href={brand.eventsUrl} style={link}>What&rsquo;s on</Link> · <Link href={brand.termsUrl} style={link}>Ticket terms</Link>
        {brand.instagramUrl ? (
          <>
            {' '}· <Link href={brand.instagramUrl} style={link}>Instagram</Link>
          </>
        ) : null}
      </Text>
      {reason ? <Text style={{ ...small, marginTop: 10 }}>{reason}</Text> : null}
    </Block>
  );
}
