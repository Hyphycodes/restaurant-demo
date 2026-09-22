import { Text } from '@react-email/components';
import { FONTS, GUTTER, PALETTE, type Surface } from '../theme';
import type { EmailOrder } from '../types';
import { formatPrice, formatStamp } from '../utils/format';
import { Block } from './Block';

/**
 * The receipt part: what was bought, what it cost, what was paid.
 *
 * Fees and tax appear only when they are non-zero — the default fee mode
 * folds them into the price, and a row of "$0" lines reads as suspicious.
 */
export function OrderSummary({ order, surface, title = 'Your order' }: { order: EmailOrder; surface: Surface; title?: string }) {
  const palette = PALETTE[surface];
  const cell = { padding: '6px 0', fontFamily: FONTS.sans, fontSize: 14, lineHeight: '20px', color: palette.text, verticalAlign: 'top' } as const;
  const right = { ...cell, textAlign: 'right', whiteSpace: 'nowrap' } as const;
  const muted = { ...cell, color: palette.muted } as const;
  const rows: { label: string; value: string; muted?: boolean; strong?: boolean }[] = order.items.map((item) => ({
    label: `${item.quantity} × ${item.tierName}`,
    value: formatPrice(item.subtotalCents),
  }));
  if (order.discountCents > 0) rows.push({ label: 'Discount', value: `−${formatPrice(order.discountCents)}`, muted: true });
  if (order.serviceFeeCents > 0) rows.push({ label: 'Service fee', value: formatPrice(order.serviceFeeCents), muted: true });
  if (order.taxCents > 0) rows.push({ label: 'Tax', value: formatPrice(order.taxCents), muted: true });

  return (
    <Block className="o-gutter" style={{ padding: `12px ${GUTTER}px` }}>
      <Text style={{ margin: '0 0 6px', fontFamily: FONTS.sans, fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: palette.muted }}>
        {title} · {order.orderNumber}
      </Text>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td style={row.muted ? muted : cell}>{row.label}</td>
              <td style={row.muted ? { ...right, color: palette.muted } : right}>{row.value}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...cell, borderTop: `1px solid ${palette.line}`, paddingTop: 10, fontWeight: 700 }}>Paid</td>
            <td style={{ ...right, borderTop: `1px solid ${palette.line}`, paddingTop: 10, fontWeight: 700 }}>{formatPrice(order.totalCents)}</td>
          </tr>
          {order.refundedCents > 0 ? (
            <tr>
              <td style={muted}>Refunded</td>
              <td style={{ ...right, color: palette.muted }}>{formatPrice(order.refundedCents)}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
      {order.paymentMethod || order.paidAt ? (
        <Text style={{ margin: '8px 0 0', fontFamily: FONTS.sans, fontSize: 13, lineHeight: '18px', color: palette.muted }}>
          {[order.paymentMethod, order.paidAt ? formatStamp(order.paidAt) : null].filter(Boolean).join(' · ')}
        </Text>
      ) : null}
    </Block>
  );
}
