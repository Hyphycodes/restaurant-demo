import { Img, Text } from '@react-email/components';
import { FONTS, GUTTER, PALETTE, type Surface } from '../theme';
import type { EmailBrand } from '../types';
import { Block } from './Block';

/**
 * The wordmark, and an optional eyebrow beside it.
 *
 * The logo is an image, so `alt` carries the name for a client that blocks
 * images; the eyebrow ("Your tickets", "Refund") is text so the email's
 * purpose survives even then.
 */
export function RestaurantHeader({
  brand,
  surface,
  eyebrow,
  align = 'left',
  compact = false,
}: {
  brand: EmailBrand;
  surface: Surface;
  eyebrow?: string;
  align?: 'left' | 'center';
  compact?: boolean;
}) {
  const palette = PALETTE[surface];
  return (
    <Block className="o-gutter" style={{ padding: `${compact ? 20 : 28}px ${GUTTER}px ${compact ? 8 : 12}px` }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            <td align={align} style={{ verticalAlign: 'middle' }}>
              {brand.logoUrl ? (
                <Img src={brand.logoUrl} alt={brand.name} width={124} height={50} style={{ display: align === 'center' ? 'inline-block' : 'block', width: 124, height: 'auto' }} />
              ) : (
                <Text style={{ margin: 0, fontFamily: FONTS.sans, fontSize: 24, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: palette.accent }}>
                  {brand.shortName}
                </Text>
              )}
            </td>
            {eyebrow && align === 'left' ? (
              <td align="right" style={{ verticalAlign: 'middle' }}>
                <Text style={{ margin: 0, fontFamily: FONTS.sans, fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: palette.muted }}>
                  {eyebrow}
                </Text>
              </td>
            ) : null}
          </tr>
        </tbody>
      </table>
      {eyebrow && align === 'center' ? (
        <Text style={{ margin: '14px 0 0', fontFamily: FONTS.sans, fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: palette.muted, textAlign: 'center' }}>
          {eyebrow}
        </Text>
      ) : null}
    </Block>
  );
}
