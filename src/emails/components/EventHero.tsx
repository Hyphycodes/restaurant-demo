import { Img, Link, Text } from '@react-email/components';
import { COLORS, FONTS, GUTTER, PALETTE, RADIUS, type Surface } from '../theme';
import type { EmailEvent } from '../types';
import { dateParts, formatEventDateHeading, formatWhen } from '../utils/format';
import { Block } from './Block';

/**
 * The event's artwork, or what stands in for it.
 *
 * The flyer is the restaurant's own promotion and a guest recognises it,
 * so it is shown whole — never cropped, because a flyer prints its date
 * and age line along its edges. With no flyer the event's name is set as
 * poster type on the event's own colour, which is what the website does.
 */
export function Artwork({
  event,
  width,
  radius = RADIUS.md,
  surface,
}: {
  event: EmailEvent;
  /** Rendered width in px. Height follows the flyer's ratio. */
  width: number;
  radius?: number;
  surface: Surface;
}) {
  if (event.artworkUrl) {
    const ratio = event.artworkWidth && event.artworkHeight ? event.artworkHeight / event.artworkWidth : 1;
    const height = Math.round(width * ratio);
    return (
      <Link href={event.eventUrl}>
        <Img
          src={event.artworkUrl}
          alt={`Flyer for ${event.title}`}
          width={width}
          height={height}
          style={{ display: 'block', width: '100%', maxWidth: width, height: 'auto', borderRadius: radius, backgroundColor: COLORS.obsidian }}
        />
      </Link>
    );
  }
  const accent = event.accentColor ?? (surface === 'dark' ? COLORS.teal : COLORS.plum);
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} style={{ maxWidth: width }}>
      <tbody>
        <tr>
          <td
            align="center"
            style={{
              backgroundColor: accent,
              borderRadius: radius,
              padding: '44px 24px',
              fontFamily: FONTS.sans,
              fontSize: width > 400 ? 34 : 24,
              lineHeight: 1.05,
              fontWeight: 800,
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
              color: COLORS.nightText,
            }}
          >
            {event.title}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/**
 * The top of an event email: headline, then the event, then when.
 *
 * Three layouts share the same content: `stacked` (artwork above the
 * words), `side` (a square of artwork beside a date block — the pass), and
 * `bleed` (artwork edge to edge, the words on a band beneath it).
 */
export function EventHero({
  event,
  headline,
  greeting,
  surface,
  layout = 'stacked',
}: {
  event: EmailEvent;
  headline: string;
  /** "Hi María," — omitted for a guest with no name. */
  greeting?: string | null;
  surface: Surface;
  layout?: 'stacked' | 'side' | 'bleed';
}) {
  const palette = PALETTE[surface];
  const when = formatWhen(event.startsAt, event.endsAt, event.doorsAt);
  const date = formatEventDateHeading(event.startsAt);

  const headlineStyle = {
    margin: 0,
    fontFamily: FONTS.sans,
    fontSize: 40,
    lineHeight: '42px',
    fontWeight: 800,
    letterSpacing: '-0.01em',
    color: palette.text,
  } as const;
  const titleStyle = { margin: '18px 0 0', fontFamily: FONTS.sans, fontSize: 22, lineHeight: '28px', fontWeight: 700, color: palette.text } as const;
  const lineStyle = { margin: '6px 0 0', fontFamily: FONTS.sans, fontSize: 16, lineHeight: '24px', color: palette.text } as const;
  const mutedStyle = { ...lineStyle, color: palette.muted, fontSize: 15 } as const;

  if (layout === 'bleed') {
    const band = event.accentColor ?? COLORS.plum;
    return (
      <>
        {event.artworkUrl ? (
          <Block style={{ padding: 0, backgroundColor: COLORS.obsidian }}>
            <Artwork event={event} width={600} radius={0} surface={surface} />
          </Block>
        ) : null}
        <Block className="o-gutter" style={{ backgroundColor: band, padding: `28px ${GUTTER}px` }}>
          {greeting ? <Text style={{ ...mutedStyle, margin: 0, color: COLORS.nightText }}>{greeting}</Text> : null}
          <Text style={{ ...headlineStyle, fontSize: 44, lineHeight: '44px', textTransform: 'uppercase', color: COLORS.nightText, marginTop: greeting ? 6 : 0 }}>{headline}</Text>
          <Text style={{ ...titleStyle, color: COLORS.nightText }}>{event.title}</Text>
          <Text style={{ ...lineStyle, color: COLORS.nightText }}>
            {date} · {when}
          </Text>
        </Block>
      </>
    );
  }

  if (layout === 'side') {
    const parts = dateParts(event.startsAt);
    return (
      <Block className="o-gutter" style={{ padding: `8px ${GUTTER}px 4px` }}>
        {greeting ? <Text style={mutedStyle}>{greeting}</Text> : null}
        <Text style={{ ...headlineStyle, marginTop: greeting ? 8 : 0 }}>{headline}</Text>
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} style={{ marginTop: 22 }}>
          <tbody>
            <tr>
              <td className="o-stack" style={{ width: 168, verticalAlign: 'top' }}>
                <Artwork event={event} width={168} surface={surface} />
              </td>
              <td className="o-stack o-stack-gap" style={{ verticalAlign: 'top', paddingLeft: 20 }}>
                <Text style={{ margin: 0, fontFamily: FONTS.sans, fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: palette.accent }}>
                  {parts.weekday} · {parts.month} {parts.day}
                </Text>
                <Text style={{ ...titleStyle, marginTop: 8 }}>{event.title}</Text>
                <Text style={lineStyle}>{when}</Text>
                <Text style={mutedStyle}>{event.venue.name}</Text>
              </td>
            </tr>
          </tbody>
        </table>
      </Block>
    );
  }

  return (
    <Block className="o-gutter" style={{ padding: `8px ${GUTTER}px 4px` }}>
      {greeting ? <Text style={mutedStyle}>{greeting}</Text> : null}
      <Text style={{ ...headlineStyle, marginTop: greeting ? 8 : 0 }}>{headline}</Text>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} style={{ marginTop: 22 }}>
        <tbody>
          <tr>
            <td align="center">
              <Artwork event={event} width={552} surface={surface} />
            </td>
          </tr>
        </tbody>
      </table>
      <Text style={titleStyle}>{event.title}</Text>
      <Text style={lineStyle}>
        {date} · {when}
      </Text>
      <Text style={mutedStyle}>{event.venue.name}</Text>
    </Block>
  );
}
