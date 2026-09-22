import { Hr, Text } from '@react-email/components';
import { EventDetails, EventHero, InfoRow, InfoTable, NoticeBox, RestaurantEmailLayout, RestaurantHeader, PrimaryButton, TicketList } from '../components';
import { COLORS, FONTS, GUTTER, PALETTE } from '../theme';
import type { EventUpdateKind, EventUpdateProps } from '../types';
import { formatEventDateCompact, formatEventDateLong, formatEventTime, formatPrice, formatTimeRangeCompact } from '../utils/format';
import { eventLines, footerLines, greetingFor, joinText, ticketLines } from '../utils/text';
import { Block } from '../components/Block';

/**
 * Something about the night changed. One template, five kinds, and in
 * every one of them the changed fact is the first thing on the screen — in
 * a box, old value struck through, new value large — before any words.
 */

const KIND: Record<EventUpdateKind, { headline: string; eyebrow: string; tone: 'warning' | 'danger' | 'info'; subject: string }> = {
  time_change: { headline: 'New start time.', eyebrow: 'Time change', tone: 'warning', subject: 'Time change' },
  date_change: { headline: 'New date.', eyebrow: 'Date change', tone: 'warning', subject: 'Date change' },
  venue_change: { headline: 'New location.', eyebrow: 'Venue change', tone: 'warning', subject: 'Venue change' },
  info: { headline: 'An update on your night.', eyebrow: 'Event update', tone: 'info', subject: 'Update' },
  postponed: { headline: 'Postponed.', eyebrow: 'Postponed', tone: 'warning', subject: 'Postponed' },
  cancelled: { headline: 'Cancelled.', eyebrow: 'Cancelled', tone: 'danger', subject: 'Cancelled' },
};

export function subject({ event, kind }: EventUpdateProps): string {
  return `${KIND[kind].subject}: ${event.title}, ${formatEventDateCompact(event.startsAt)}`;
}

function changeLines({ kind, event, previous, refundCents }: EventUpdateProps): string[] {
  const lines: string[] = [];
  if (kind === 'time_change' || kind === 'date_change') {
    if (previous?.startsAt && previous.endsAt) lines.push(`Was: ${formatEventDateLong(previous.startsAt)} · ${formatTimeRangeCompact(previous.startsAt, previous.endsAt)}`);
    lines.push(`Now: ${formatEventDateLong(event.startsAt)} · ${formatTimeRangeCompact(event.startsAt, event.endsAt)}${event.doorsAt ? ` (doors ${formatEventTime(event.doorsAt)})` : ''}`);
  }
  if (kind === 'venue_change') {
    if (previous?.venue) lines.push(`Was: ${previous.venue.name}, ${previous.venue.address}`);
    lines.push(`Now: ${event.venue.name}, ${event.venue.address}`);
  }
  if (kind === 'cancelled') {
    lines.push(
      refundCents && refundCents > 0
        ? `Your ${formatPrice(refundCents)} is being refunded automatically to the card you paid with. Banks take 5–10 business days to show it.`
        : 'Your tickets are cancelled. If you paid, your refund is being arranged.',
    );
  }
  if (kind === 'postponed') lines.push('Your tickets carry over to the new date. We will email you as soon as it is set.');
  return lines;
}

export function preheader(props: EventUpdateProps): string {
  return `${KIND[props.kind].headline} ${changeLines(props)[0] ?? props.event.title}`;
}

export function text(props: EventUpdateProps): string {
  const { brand, customer, event, order, tickets, kind, message } = props;
  const live = kind !== 'cancelled';
  return joinText(
    greetingFor(customer),
    `${KIND[kind].headline} ${event.title}`,
    changeLines(props),
    message,
    live ? eventLines(event) : null,
    live && tickets.length > 0 ? ['Your tickets are unchanged:', ...ticketLines(tickets)] : null,
    live && order ? `Open your tickets: ${order.ticketsUrl}` : null,
    order ? `Order ${order.orderNumber}` : null,
    `Questions? ${brand.supportEmail ? `Reply to this email or call ${brand.phone}.` : `Call ${brand.phone}.`}`,
    footerLines(brand),
  );
}

export default function EventUpdate(props: EventUpdateProps) {
  const { brand, customer, event, order, tickets, kind, previous, message, refundCents, test } = props;
  const surface = 'dark';
  const palette = PALETTE.dark;
  const spec = KIND[kind];
  const cancelled = kind === 'cancelled';
  const body = { margin: 0, fontFamily: FONTS.sans, fontSize: 16, lineHeight: '24px', color: palette.text } as const;
  const was = { fontFamily: FONTS.sans, fontSize: 14, lineHeight: '20px', color: palette.muted, textDecoration: 'line-through' } as const;
  const now = { margin: '4px 0 0', fontFamily: FONTS.sans, fontSize: 20, lineHeight: '26px', fontWeight: 700, color: palette.text } as const;

  return (
    <RestaurantEmailLayout preview={preheader(props)} surface={surface} brand={brand} test={test} footerReason={`Sent to ${customer.email} because you have tickets for this event.`}>
      <RestaurantHeader brand={brand} surface={surface} eyebrow={spec.eyebrow} />
      <EventHero event={event} headline={spec.headline} greeting={greetingFor(customer)} surface={surface} layout="side" />

      <Block className="o-gutter" style={{ padding: `20px ${GUTTER}px 8px` }}>
        <NoticeBox tone={spec.tone} title={spec.eyebrow} surface={surface}>
          {(kind === 'time_change' || kind === 'date_change') && (
            <>
              {previous?.startsAt && previous.endsAt ? (
                <span style={was}>
                  {formatEventDateLong(previous.startsAt)} · {formatTimeRangeCompact(previous.startsAt, previous.endsAt)}
                </span>
              ) : null}
              <Text style={now}>
                {formatEventDateLong(event.startsAt)} · {formatTimeRangeCompact(event.startsAt, event.endsAt)}
              </Text>
              {event.doorsAt ? <span style={{ color: palette.muted }}>Doors {formatEventTime(event.doorsAt)}</span> : null}
            </>
          )}
          {kind === 'venue_change' && (
            <>
              {previous?.venue ? <span style={was}>{previous.venue.name}</span> : null}
              <Text style={now}>{event.venue.name}</Text>
              <span style={{ color: palette.muted }}>{event.venue.address}</span>
            </>
          )}
          {kind === 'cancelled' && (
            <>
              <Text style={now}>{event.title} will not go ahead.</Text>
              <span>{changeLines(props)[0]}</span>
            </>
          )}
          {kind === 'postponed' && (
            <>
              <Text style={now}>{event.title} is moving to a new date.</Text>
              <span>{changeLines(props)[0]}</span>
            </>
          )}
          {kind === 'info' && <span>Details for {event.title} have changed. Everything current is below.</span>}
        </NoticeBox>
      </Block>

      {message ? (
        <Block className="o-gutter" style={{ padding: `12px ${GUTTER}px 4px` }}>
          {message.split(/\n{2,}/).map((paragraph, index) => (
            <Text key={index} style={{ ...body, marginTop: index === 0 ? 0 : 12 }}>
              {paragraph}
            </Text>
          ))}
        </Block>
      ) : null}

      {cancelled ? (
        <>
          <Block className="o-gutter" style={{ padding: `16px ${GUTTER}px 4px` }}>
            <InfoTable>
              {order ? (
                <InfoRow label="Order" surface={surface}>
                  {order.orderNumber}
                </InfoRow>
              ) : null}
              <InfoRow label="Refund" surface={surface}>
                {refundCents && refundCents > 0 ? `${formatPrice(refundCents)} · automatic` : 'Being arranged'}
              </InfoRow>
              <InfoRow label="Tickets" surface={surface} last>
                {tickets.length > 0 ? `${tickets.length} cancelled · ${tickets.map((ticket) => ticket.code).join(', ')}` : 'Cancelled'}
              </InfoRow>
            </InfoTable>
          </Block>
          <Block className="o-gutter" style={{ padding: `16px ${GUTTER}px 12px` }}>
            <PrimaryButton href={brand.eventsUrl} surface={surface} block>
              See what&rsquo;s on next
            </PrimaryButton>
          </Block>
        </>
      ) : (
        <>
          {order ? (
            <Block className="o-gutter" style={{ padding: `12px ${GUTTER}px 8px` }}>
              <PrimaryButton href={order.ticketsUrl} surface={surface} block>
                View tickets
              </PrimaryButton>
            </Block>
          ) : null}
          <Block className="o-gutter" style={{ padding: `8px ${GUTTER}px 0` }}>
            <Hr style={{ borderTop: `1px solid ${palette.line}`, margin: 0 }} />
          </Block>
          <EventDetails event={event} surface={surface} />
          {tickets.length > 0 ? (
            <>
              <Block className="o-gutter" style={{ padding: `14px ${GUTTER}px 0` }}>
                <Text style={{ margin: 0, fontFamily: FONTS.sans, fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: COLORS.amber }}>
                  Your tickets are unchanged
                </Text>
              </Block>
              <TicketList tickets={tickets} ticketsUrl={order?.ticketsUrl ?? event.eventUrl} surface={surface} style="pass" />
            </>
          ) : null}
        </>
      )}
      <Block className="o-gutter" style={{ padding: `8px ${GUTTER}px 12px` }}>
        <Text style={{ ...body, fontSize: 14, lineHeight: '21px', color: palette.muted }}>
          Questions? {brand.supportEmail ? 'Reply to this email or call ' : 'Call '}
          {brand.phone}.
        </Text>
      </Block>
    </RestaurantEmailLayout>
  );
}
