import { Link, Text } from '@react-email/components';
import { FONTS, GUTTER, PALETTE, type Surface } from '../theme';
import type { EmailVenue } from '../types';
import { Block } from './Block';

/** Name, address and the way there. For emails that do not need the whole details table. */
export function VenueDetails({ venue, surface }: { venue: EmailVenue; surface: Surface }) {
  const palette = PALETTE[surface];
  return (
    <Block className="o-gutter" style={{ padding: `4px ${GUTTER}px` }}>
      <Text style={{ margin: 0, fontFamily: FONTS.sans, fontSize: 15, lineHeight: '22px', fontWeight: 700, color: palette.text }}>{venue.name}</Text>
      <Text style={{ margin: 0, fontFamily: FONTS.sans, fontSize: 15, lineHeight: '22px', color: palette.muted }}>
        {venue.address} ·{' '}
        <Link href={venue.directionsUrl} style={{ color: palette.link, textDecoration: 'underline' }}>
          Directions
        </Link>
      </Text>
    </Block>
  );
}
