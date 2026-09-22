import { Hr, Text } from '@react-email/components';
import { InfoRow, InfoTable, NoticeBox, RestaurantEmailLayout, RestaurantHeader, OrderSummary, PrimaryButton } from '../components';
import { FONTS, GUTTER, PALETTE } from '../theme';
import type { RefundConfirmationProps } from '../types';
import { formatEventDateCompact, formatPrice, formatWhenLong, pluralize } from '../utils/format';
import { footerLines, greetingFor, joinText, orderLines } from '../utils/text';
import { Block } from '../components/Block';

/**
 * Money going back. Clarity over everything: the amount, where it goes,
 * how long it takes, which tickets stop working. Light surface, no flyer —
 * this is a receipt, not an invitation.
 */

export function subject({ event, refundCents }: RefundConfirmationProps): string {
  return `Refund of ${formatPrice(refundCents)} — ${event.title}, ${formatEventDateCompact(event.startsAt)}`;
}

function destination({ order, status }: RefundConfirmationProps): string {
  const card = order.paymentMethod ? `your ${order.paymentMethod}` : 'the card you paid with';
  return status === 'completed' ? 'Given back at the register.' : `Going back to ${card}. Banks take 5–10 business days to show it.`;
}

export function preheader(props: RefundConfirmationProps): string {
  return `${formatPrice(props.refundCents)} is on its way back. ${destination(props)}`;
}

export function text(props: RefundConfirmationProps): string {
  const { brand, customer, event, order, refundCents, tickets, full, reason } = props;
  return joinText(
    greetingFor(customer),
    `Your refund of ${formatPrice(refundCents)} is ${props.status === 'completed' ? 'done' : 'on its way'}.`,
    [`Event: ${event.title}`, formatWhenLong(event.startsAt, event.endsAt), `Refund: ${formatPrice(refundCents)}`, `To: ${destination(props)}`],
    reason,
    full
      ? 'Every ticket on this order is now cancelled and will not scan at the door.'
      : tickets.length > 0
        ? [`${pluralize(tickets.length, 'ticket')} cancelled:`, ...tickets.map((ticket) => `  ${ticket.code}  ${ticket.tierName}`), 'Your other tickets are unchanged.']
        : null,
    orderLines(order),
    `Questions? ${brand.supportEmail ? `Reply to this email or call ${brand.phone}.` : `Call ${brand.phone}.`}`,
    footerLines(brand),
  );
}

export default function RefundConfirmation(props: RefundConfirmationProps) {
  const { brand, customer, event, order, refundCents, tickets, full, status, reason, test } = props;
  const surface = 'light';
  const palette = PALETTE.light;
  const body = { margin: 0, fontFamily: FONTS.sans, fontSize: 16, lineHeight: '24px', color: palette.text } as const;
  return (
    <RestaurantEmailLayout preview={preheader(props)} surface={surface} brand={brand} test={test} footerReason={`Sent to ${customer.email} about order ${order.orderNumber}.`}>
      <RestaurantHeader brand={brand} surface={surface} eyebrow="Refund" />
      <Block className="o-gutter" style={{ padding: `8px ${GUTTER}px 4px` }}>
        {greetingFor(customer) ? <Text style={{ ...body, color: palette.muted }}>{greetingFor(customer)}</Text> : null}
        <Text style={{ margin: '8px 0 0', fontFamily: FONTS.sans, fontSize: 34, lineHeight: '38px', fontWeight: 800, color: palette.text }}>
          {formatPrice(refundCents)} {status === 'completed' ? 'refunded.' : 'is on its way back.'}
        </Text>
        <Text style={{ ...body, marginTop: 12 }}>{destination(props)}</Text>
      </Block>
      <Block className="o-gutter" style={{ padding: `16px ${GUTTER}px 4px` }}>
        <InfoTable>
          <InfoRow label="Event" surface={surface}>
            {event.title}
            <br />
            <span style={{ color: palette.muted }}>{formatWhenLong(event.startsAt, event.endsAt)}</span>
          </InfoRow>
          <InfoRow label="Order" surface={surface}>
            {order.orderNumber}
          </InfoRow>
          <InfoRow label="Refund" surface={surface}>
            {formatPrice(refundCents)}
            {order.refundedCents > refundCents ? <span style={{ color: palette.muted }}> · {formatPrice(order.refundedCents)} refunded in total</span> : null}
          </InfoRow>
          <InfoRow label="Status" surface={surface} last>
            {status === 'completed' ? 'Complete' : 'Processing — 5 to 10 business days'}
          </InfoRow>
        </InfoTable>
      </Block>
      {reason ? (
        <Block className="o-gutter" style={{ padding: `14px ${GUTTER}px 4px` }}>
          <Text style={{ ...body, fontSize: 15, lineHeight: '22px' }}>{reason}</Text>
        </Block>
      ) : null}
      <Block className="o-gutter" style={{ padding: `14px ${GUTTER}px 8px` }}>
        <NoticeBox tone={full ? 'danger' : 'warning'} title={full ? 'Tickets cancelled' : `${pluralize(tickets.length, 'ticket')} cancelled`} surface={surface}>
          {full ? 'Every ticket on this order is now cancelled and will not scan at the door.' : 'These codes no longer work at the door. Your other tickets are unchanged.'}
          {!full && tickets.length > 0 ? (
            <>
              <br />
              <span style={{ fontFamily: FONTS.mono, letterSpacing: '0.08em' }}>{tickets.map((ticket) => ticket.code).join(' · ')}</span>
            </>
          ) : null}
        </NoticeBox>
      </Block>
      <Block className="o-gutter" style={{ padding: `8px ${GUTTER}px 0` }}>
        <Hr style={{ borderTop: `1px solid ${palette.line}`, margin: 0 }} />
      </Block>
      <OrderSummary order={order} surface={surface} title="Original order" />
      <Block className="o-gutter" style={{ padding: `8px ${GUTTER}px 12px` }}>
        <Text style={{ ...body, fontSize: 14, lineHeight: '21px', color: palette.muted }}>
          Questions about this refund? {brand.supportEmail ? 'Reply to this email or call ' : 'Call '}
          {brand.phone}.
        </Text>
        {!full ? (
          <div style={{ marginTop: 14 }}>
            <PrimaryButton href={order.ticketsUrl} surface={surface} variant="secondary">
              View remaining tickets
            </PrimaryButton>
          </div>
        ) : (
          <div style={{ marginTop: 14 }}>
            <PrimaryButton href={brand.eventsUrl} surface={surface} variant="secondary">
              See what&rsquo;s on
            </PrimaryButton>
          </div>
        )}
      </Block>
    </RestaurantEmailLayout>
  );
}
