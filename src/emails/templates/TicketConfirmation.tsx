import { Hr, Text } from '@react-email/components';
import { Artwork, EventDetails, EventHero, NoticeBox, RestaurantEmailLayout, RestaurantHeader, OrderSummary, PrimaryButton, TicketList } from '../components';
import { COLORS, FONTS, GUTTER, PALETTE } from '../theme';
import type { TicketConfirmationProps, TicketDirection } from '../types';
import { formatEventDateCompact, formatEventDateHeading, formatWhen, pluralize } from '../utils/format';
import { eventLines, footerLines, greetingFor, joinText, orderLines, ticketLines } from '../utils/text';
import { Block } from '../components/Block';

/**
 * The ticket confirmation. The most important email in the system.
 *
 * Three directions, one set of data and components:
 *
 *   pass       — DEFAULT. Espresso ground, the flyer beside a date block, one
 *                pass-shaped card per ticket with a perforation above the
 *                QR. Feels like being handed something.
 *   editorial  — Ivory ground, serif headline, the flyer framed at a modest
 *                width, generous space. Feels like a good restaurant's
 *                stationery.
 *   poster     — The flyer edge to edge, the words on a band in the event's
 *                own colour, then the tickets. Feels like the night itself.
 *
 * Whichever direction: within one screen the guest knows they are in, which
 * night, when, where, and that the QR is right here.
 */

export const DEFAULT_TICKET_DIRECTION: TicketDirection = 'pass';

export function subject({ event, tickets }: TicketConfirmationProps): string {
  const count = tickets.length > 1 ? ` (${tickets.length} tickets)` : '';
  return `You're in — ${event.title}, ${formatEventDateCompact(event.startsAt)}${count}`;
}

export function preheader({ event, tickets }: TicketConfirmationProps): string {
  return `${pluralize(tickets.length, 'ticket')} for ${formatEventDateHeading(event.startsAt)} · ${formatWhen(event.startsAt, event.endsAt, event.doorsAt)}. Your QR codes are inside.`;
}

export function text(props: TicketConfirmationProps): string {
  const { brand, customer, event, order, tickets } = props;
  return joinText(
    greetingFor(customer),
    "You're in.",
    eventLines(event),
    [`Your ${pluralize(tickets.length, 'ticket')} — show any of these at the door, on your phone or printed:`, ...ticketLines(tickets)],
    `Open your tickets with QR codes: ${order.ticketsUrl}`,
    event.arrivalNote,
    orderLines(order),
    event.refundPolicy,
    `Directions: ${event.venue.directionsUrl}`,
    footerLines(brand),
  );
}

function ArrivalNote({ note, surface }: { note: string | null; surface: 'dark' | 'light' }) {
  if (!note) return null;
  return (
    <Block className="o-gutter" style={{ padding: `10px ${GUTTER}px` }}>
      <NoticeBox tone="info" title="On the night" surface={surface}>
        {note}
      </NoticeBox>
    </Block>
  );
}

function Actions({ order, event, surface }: { order: TicketConfirmationProps['order']; event: TicketConfirmationProps['event']; surface: 'dark' | 'light' }) {
  return (
    <Block className="o-gutter" style={{ padding: `12px ${GUTTER}px 8px` }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            <td className="o-stack" style={{ width: '58%', paddingRight: 8 }}>
              <PrimaryButton href={order.ticketsUrl} surface={surface} block>
                View tickets
              </PrimaryButton>
            </td>
            <td className="o-stack o-stack-gap" style={{ paddingLeft: 8 }}>
              <PrimaryButton href={event.venue.directionsUrl} surface={surface} variant="secondary" block>
                Directions
              </PrimaryButton>
            </td>
          </tr>
        </tbody>
      </table>
    </Block>
  );
}

function Policy({ policy, surface }: { policy: string | null; surface: 'dark' | 'light' }) {
  if (!policy) return null;
  return (
    <Block className="o-gutter" style={{ padding: `0 ${GUTTER}px 12px` }}>
      <Text style={{ margin: 0, fontFamily: FONTS.sans, fontSize: 13, lineHeight: '19px', color: PALETTE[surface].muted }}>{policy}</Text>
    </Block>
  );
}

function Pass(props: TicketConfirmationProps) {
  const { brand, customer, event, order, tickets, test } = props;
  const surface = 'dark';
  return (
    <RestaurantEmailLayout preview={preheader(props)} surface={surface} brand={brand} test={test} footerReason={`Sent to ${customer.email} because tickets were bought for this event.`}>
      <RestaurantHeader brand={brand} surface={surface} eyebrow="Your tickets" />
      <EventHero event={event} headline="You’re in." greeting={greetingFor(customer)} surface={surface} layout="side" />
      <Block style={{ height: 12 }} />
      <TicketList tickets={tickets} ticketsUrl={order.ticketsUrl} surface={surface} style="pass" />
      <ArrivalNote note={event.arrivalNote} surface={surface} />
      <Actions order={order} event={event} surface={surface} />
      <Block className="o-gutter" style={{ padding: `8px ${GUTTER}px 0` }}>
        <Hr style={{ borderTop: `1px solid ${PALETTE.dark.line}`, margin: 0 }} />
      </Block>
      <EventDetails event={event} surface={surface} />
      <OrderSummary order={order} surface={surface} />
      <Policy policy={event.refundPolicy} surface={surface} />
    </RestaurantEmailLayout>
  );
}

function Editorial(props: TicketConfirmationProps) {
  const { brand, customer, event, order, tickets, test } = props;
  const surface = 'light';
  const palette = PALETTE.light;
  const greeting = greetingFor(customer);
  return (
    <RestaurantEmailLayout preview={preheader(props)} surface={surface} brand={brand} test={test} footerReason={`Sent to ${customer.email} because tickets were bought for this event.`}>
      <RestaurantHeader brand={brand} surface={surface} align="center" />
      <Block className="o-gutter" style={{ padding: `12px ${GUTTER}px 0`, textAlign: 'center' }}>
        <Text style={{ margin: 0, fontFamily: FONTS.sans, fontSize: 11, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: palette.muted }}>
          {greeting ? `${greeting.replace(/,$/, '')} —` : 'Your reservation'}
        </Text>
        <Text style={{ margin: '12px 0 0', fontFamily: FONTS.serif, fontSize: 52, lineHeight: '54px', fontWeight: 400, fontStyle: 'italic', color: palette.text }}>You’re in.</Text>
        <Hr style={{ borderTop: `1px solid ${palette.line}`, width: 64, margin: '22px auto 0' }} />
        <Text style={{ margin: '20px 0 0', fontFamily: FONTS.serif, fontSize: 28, lineHeight: '34px', color: palette.text }}>{event.title}</Text>
        <Text style={{ margin: '8px 0 0', fontFamily: FONTS.sans, fontSize: 15, lineHeight: '22px', color: palette.text }}>
          {formatEventDateHeading(event.startsAt)} · {formatWhen(event.startsAt, event.endsAt, event.doorsAt)}
        </Text>
        <Text style={{ margin: '2px 0 0', fontFamily: FONTS.sans, fontSize: 14, lineHeight: '20px', color: palette.muted }}>{event.venue.name}</Text>
      </Block>
      <Block className="o-gutter" style={{ padding: `26px ${GUTTER}px 8px` }}>
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
          <tbody>
            <tr>
              <td align="center">
                <table role="presentation" cellPadding={0} cellSpacing={0} border={0}>
                  <tbody>
                    <tr>
                      <td style={{ padding: 8, backgroundColor: COLORS.white, border: `1px solid ${palette.line}` }}>
                        <Artwork event={event} width={320} radius={2} surface={surface} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </Block>
      <Block className="o-gutter" style={{ padding: `20px ${GUTTER}px 4px` }}>
        <Text style={{ margin: 0, fontFamily: FONTS.sans, fontSize: 11, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: palette.muted, textAlign: 'center' }}>
          {pluralize(tickets.length, 'Ticket')}
        </Text>
      </Block>
      <TicketList tickets={tickets} ticketsUrl={order.ticketsUrl} surface={surface} style="plain" />
      <ArrivalNote note={event.arrivalNote} surface={surface} />
      <Actions order={order} event={event} surface={surface} />
      <Block className="o-gutter" style={{ padding: `12px ${GUTTER}px 0` }}>
        <Hr style={{ borderTop: `1px solid ${palette.line}`, margin: 0 }} />
      </Block>
      <EventDetails event={event} surface={surface} />
      <OrderSummary order={order} surface={surface} />
      <Policy policy={event.refundPolicy} surface={surface} />
    </RestaurantEmailLayout>
  );
}

function Poster(props: TicketConfirmationProps) {
  const { brand, customer, event, order, tickets, test } = props;
  const surface = 'dark';
  return (
    <RestaurantEmailLayout preview={preheader(props)} surface={surface} brand={brand} test={test} footerReason={`Sent to ${customer.email} because tickets were bought for this event.`}>
      <RestaurantHeader brand={brand} surface={surface} eyebrow="Your tickets" compact />
      <EventHero event={event} headline="You’re in" greeting={greetingFor(customer)} surface={surface} layout="bleed" />
      <Block style={{ height: 16 }} />
      <TicketList tickets={tickets} ticketsUrl={order.ticketsUrl} surface={surface} style="pass" />
      <ArrivalNote note={event.arrivalNote} surface={surface} />
      <Actions order={order} event={event} surface={surface} />
      <Block className="o-gutter" style={{ padding: `8px ${GUTTER}px 0` }}>
        <Hr style={{ borderTop: `1px solid ${PALETTE.dark.line}`, margin: 0 }} />
      </Block>
      <EventDetails event={event} surface={surface} />
      <OrderSummary order={order} surface={surface} />
      <Policy policy={event.refundPolicy} surface={surface} />
    </RestaurantEmailLayout>
  );
}

export default function TicketConfirmation(props: TicketConfirmationProps) {
  const direction = props.direction ?? DEFAULT_TICKET_DIRECTION;
  if (direction === 'editorial') return <Editorial {...props} />;
  if (direction === 'poster') return <Poster {...props} />;
  return <Pass {...props} />;
}
