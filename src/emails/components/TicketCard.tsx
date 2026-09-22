import { Link, Text } from '@react-email/components';
import { COLORS, FONTS, GUTTER, PALETTE, RADIUS, type Surface } from '../theme';
import type { EmailTicket } from '../types';
import { PrimaryButton } from './PrimaryButton';
import { QRCodeSection } from './QRCodeSection';
import { Block } from './Block';

/**
 * One ticket: tier, position in the order, QR, code, its own link.
 *
 * `pass` is a card with a perforation between the stub and the code, the
 * digital-pass direction. `plain` is the same content with no card, for the
 * editorial direction and the reminder. A void or refunded ticket shows its
 * state instead of a QR, so an old email cannot pass for a live one.
 */
export function TicketCard({
  ticket,
  index,
  total,
  surface,
  style = 'pass',
}: {
  ticket: EmailTicket;
  index: number;
  total: number;
  surface: Surface;
  style?: 'pass' | 'plain';
}) {
  const palette = PALETTE[surface];
  const live = ticket.status === 'valid' || ticket.status === 'checked_in';
  const label = { valid: null, checked_in: 'Already checked in', void: 'Cancelled', refunded: 'Refunded' }[ticket.status];
  const seats = ticket.seats > 1 ? ` · ${ticket.seats} seats` : '';
  const position = total > 1 ? `Ticket ${index + 1} of ${total}` : 'Your ticket';

  const stub = (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
      <tbody>
        <tr>
          <td style={{ verticalAlign: 'top' }}>
            <Text style={{ margin: 0, fontFamily: FONTS.sans, fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: palette.accent }}>{position}</Text>
            <Text style={{ margin: '4px 0 0', fontFamily: FONTS.sans, fontSize: 18, lineHeight: '24px', fontWeight: 700, color: palette.text }}>
              {ticket.tierName}
              <span style={{ fontWeight: 400, color: palette.muted }}>{seats}</span>
            </Text>
            {ticket.attendeeName ? <Text style={{ margin: '2px 0 0', fontFamily: FONTS.sans, fontSize: 14, color: palette.muted }}>{ticket.attendeeName}</Text> : null}
          </td>
          {label ? (
            <td align="right" style={{ verticalAlign: 'top' }}>
              <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, backgroundColor: live ? COLORS.successSoft : COLORS.dangerSoft, color: live ? COLORS.success : COLORS.danger, fontFamily: FONTS.sans, fontSize: 12, fontWeight: 700 }}>
                {label}
              </span>
            </td>
          ) : null}
        </tr>
      </tbody>
    </table>
  );

  const body = live ? (
    <>
      <QRCodeSection src={ticket.qrSrc} code={ticket.code} />
      <Text style={{ margin: '14px 0 0', fontFamily: FONTS.sans, fontSize: 13, lineHeight: '18px', color: palette.muted, textAlign: 'center' }}>
        <Link href={ticket.ticketUrl} style={{ color: palette.link, textDecoration: 'underline' }}>
          Open this ticket
        </Link>
        {total > 1 ? ' · forward the link to whoever is using it' : ''}
      </Text>
    </>
  ) : (
    <Text style={{ margin: 0, fontFamily: FONTS.mono, fontSize: 16, letterSpacing: '0.1em', color: palette.muted, textAlign: 'center', textDecoration: 'line-through' }}>{ticket.code}</Text>
  );

  if (style === 'plain') {
    return (
      <Block className="o-gutter" style={{ padding: `12px ${GUTTER}px` }}>
        {stub}
        <div style={{ marginTop: 14 }}>{body}</div>
      </Block>
    );
  }

  return (
    <Block className="o-gutter" style={{ padding: `8px ${GUTTER}px` }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} style={{ backgroundColor: palette.raised, borderRadius: RADIUS.lg, border: `1px solid ${palette.line}` }}>
        <tbody>
          <tr>
            <td style={{ padding: '18px 20px 14px' }}>{stub}</td>
          </tr>
          <tr>
            <td style={{ padding: '0 20px' }}>
              <div style={{ borderTop: `2px dashed ${palette.line}`, height: 0, lineHeight: 0, fontSize: 0 }}>&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td style={{ padding: '18px 20px 20px' }}>{body}</td>
          </tr>
        </tbody>
      </table>
    </Block>
  );
}

/** Up to this many tickets get their own card; past it the email shows the first and links to the rest. */
export const INLINE_TICKET_LIMIT = 4;

/**
 * The multi-ticket decision, in one place.
 *
 * One to four tickets: a card each, so a group of three walks up to the
 * door with three codes on one screen and no scrolling hunt. Five or more:
 * the first card, one button to the page with all of them, and every code
 * as text. A wall of large images is slow to load and, in Gmail, gets the
 * email clipped — and nobody scans nine QRs off one phone anyway.
 */
export function TicketList({
  tickets,
  ticketsUrl,
  surface,
  style = 'pass',
}: {
  tickets: EmailTicket[];
  ticketsUrl: string;
  surface: Surface;
  style?: 'pass' | 'plain';
}) {
  const palette = PALETTE[surface];
  const shown = tickets.length > INLINE_TICKET_LIMIT ? tickets.slice(0, 1) : tickets;
  const rest = tickets.slice(shown.length);
  return (
    <>
      {shown.map((ticket, index) => (
        <TicketCard key={ticket.id} ticket={ticket} index={index} total={tickets.length} surface={surface} style={style} />
      ))}
      {rest.length > 0 ? (
        <Block className="o-gutter" style={{ padding: `8px ${GUTTER}px 12px` }}>
          <Text style={{ margin: '0 0 12px', fontFamily: FONTS.sans, fontSize: 15, lineHeight: '22px', color: palette.text }}>
            {tickets.length} tickets in this order. The first is above; every one has its own QR on your tickets page.
          </Text>
          <PrimaryButton href={ticketsUrl} surface={surface} block>
            Open all {tickets.length} tickets
          </PrimaryButton>
          <Text style={{ margin: '14px 0 0', fontFamily: FONTS.sans, fontSize: 13, lineHeight: '20px', color: palette.muted }}>
            The other codes:{' '}
            {rest.map((ticket, index) => (
              <span key={ticket.id}>
                <Link href={ticket.ticketUrl} style={{ color: palette.link, fontFamily: FONTS.mono, textDecoration: 'underline' }}>
                  {ticket.code}
                </Link>
                {index < rest.length - 1 ? ' · ' : ''}
              </span>
            ))}
          </Text>
        </Block>
      ) : null}
    </>
  );
}
