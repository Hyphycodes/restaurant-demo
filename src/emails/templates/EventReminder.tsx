import { Hr, Text } from '@react-email/components';
import { EventDetails, EventHero, NoticeBox, RestaurantEmailLayout, RestaurantHeader, PrimaryButton, TicketList } from '../components';
import { FONTS, GUTTER, PALETTE } from '../theme';
import type { EventReminderProps } from '../types';
import { formatTimeRangeCompact, formatWhen } from '../utils/format';
import { eventLines, footerLines, greetingFor, joinText, ticketLines } from '../utils/text';
import { Block } from '../components/Block';

/**
 * The day before, or the afternoon of. Short: it is read on the way out of
 * the house. The tickets are here again so nobody has to dig for the
 * original email standing in line.
 */

const DEFAULT_ARRIVAL = 'Arrive a little early to pick your seat. Turn your screen brightness up at the door — it is the one thing scanners struggle with.';

export function headline({ timing, brand }: EventReminderProps): string {
  return timing === 'tonight' ? `Tonight at ${brand.shortName}` : `Tomorrow at ${brand.shortName}`;
}

export function subject(props: EventReminderProps): string {
  const { event, timing } = props;
  return `${timing === 'tonight' ? 'Tonight' : 'Tomorrow'} — ${event.title}, ${formatTimeRangeCompact(event.startsAt, event.endsAt)}`;
}

export function preheader({ event, timing }: EventReminderProps): string {
  return `${event.title} is ${timing === 'tonight' ? 'tonight' : 'tomorrow'}, ${formatWhen(event.startsAt, event.endsAt, event.doorsAt)}. Your tickets are inside.`;
}

export function text(props: EventReminderProps): string {
  const { brand, customer, event, order, tickets } = props;
  return joinText(
    greetingFor(customer),
    `${headline(props)}.`,
    eventLines(event),
    event.arrivalNote ?? DEFAULT_ARRIVAL,
    ['Your tickets:', ...ticketLines(tickets)],
    `Open your tickets with QR codes: ${order.ticketsUrl}`,
    `Directions: ${event.venue.directionsUrl}`,
    footerLines(brand),
  );
}

export default function EventReminder(props: EventReminderProps) {
  const { brand, customer, event, order, tickets, test } = props;
  const surface = 'dark';
  return (
    <RestaurantEmailLayout preview={preheader(props)} surface={surface} brand={brand} test={test} footerReason={`Sent to ${customer.email} because you have tickets for this event.`}>
      <RestaurantHeader brand={brand} surface={surface} eyebrow="Reminder" />
      <EventHero event={event} headline={`${headline(props)}.`} greeting={greetingFor(customer)} surface={surface} layout="side" />
      <Block className="o-gutter" style={{ padding: `18px ${GUTTER}px 8px` }}>
        <NoticeBox tone="info" title="Before you leave" surface={surface}>
          {event.arrivalNote ?? DEFAULT_ARRIVAL}
        </NoticeBox>
      </Block>
      <Block className="o-gutter" style={{ padding: `12px ${GUTTER}px 8px` }}>
        <PrimaryButton href={order.ticketsUrl} surface={surface} block>
          View tickets
        </PrimaryButton>
      </Block>
      <Block className="o-gutter" style={{ padding: `10px ${GUTTER}px 0` }}>
        <Text style={{ margin: 0, fontFamily: FONTS.sans, fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: PALETTE.dark.muted }}>
          Your tickets
        </Text>
      </Block>
      <TicketList tickets={tickets} ticketsUrl={order.ticketsUrl} surface={surface} style="pass" />
      <Block className="o-gutter" style={{ padding: `12px ${GUTTER}px 0` }}>
        <Hr style={{ borderTop: `1px solid ${PALETTE.dark.line}`, margin: 0 }} />
      </Block>
      <EventDetails event={event} surface={surface} />
      <Block className="o-gutter" style={{ padding: `4px ${GUTTER}px 12px` }}>
        <Text style={{ margin: 0, fontFamily: FONTS.sans, fontSize: 13, lineHeight: '19px', color: PALETTE.dark.muted }}>Order {order.orderNumber}</Text>
      </Block>
    </RestaurantEmailLayout>
  );
}
