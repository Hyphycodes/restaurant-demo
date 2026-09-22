import { Text } from '@react-email/components';
import { EventHero, RestaurantEmailLayout, RestaurantHeader, PrimaryButton, TicketList, VenueDetails } from '../components';
import { FONTS, GUTTER, PALETTE } from '../theme';
import type { TicketResendProps } from '../types';
import { formatEventDateCompact } from '../utils/format';
import { eventLines, footerLines, greetingFor, joinText, ticketLines } from '../utils/text';
import { Block } from '../components/Block';

/**
 * "Send me my tickets again." Somebody asked for this, probably in a hurry,
 * so the tickets come first and everything else is one line.
 */

export function subject({ event }: TicketResendProps): string {
  return `Your tickets — ${event.title}, ${formatEventDateCompact(event.startsAt)}`;
}

export function preheader({ event }: TicketResendProps): string {
  return `Here they are again: your tickets for ${event.title}.`;
}

export function text(props: TicketResendProps): string {
  const { brand, customer, event, order, tickets } = props;
  return joinText(
    greetingFor(customer),
    'Here are your tickets again.',
    eventLines(event),
    ticketLines(tickets),
    `Open your tickets with QR codes: ${order.ticketsUrl}`,
    footerLines(brand),
  );
}

export default function TicketResend(props: TicketResendProps) {
  const { brand, customer, event, order, tickets, test } = props;
  const surface = 'dark';
  return (
    <RestaurantEmailLayout preview={preheader(props)} surface={surface} brand={brand} test={test} footerReason={`Sent to ${customer.email} because these tickets were requested again.`}>
      <RestaurantHeader brand={brand} surface={surface} eyebrow="Your tickets" compact />
      <EventHero event={event} headline="Here they are again." greeting={greetingFor(customer)} surface={surface} layout="side" />
      <Block style={{ height: 12 }} />
      <TicketList tickets={tickets} ticketsUrl={order.ticketsUrl} surface={surface} style="pass" />
      <Block className="o-gutter" style={{ padding: `12px ${GUTTER}px 8px` }}>
        <PrimaryButton href={order.ticketsUrl} surface={surface} block>
          View tickets
        </PrimaryButton>
      </Block>
      <VenueDetails venue={event.venue} surface={surface} />
      <Block className="o-gutter" style={{ padding: `8px ${GUTTER}px 12px` }}>
        <Text style={{ margin: 0, fontFamily: FONTS.sans, fontSize: 13, lineHeight: '19px', color: PALETTE.dark.muted }}>Order {order.orderNumber}</Text>
      </Block>
    </RestaurantEmailLayout>
  );
}
