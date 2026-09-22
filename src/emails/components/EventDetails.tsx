import { GUTTER, type Surface } from '../theme';
import type { EmailEvent } from '../types';
import { formatEventDateLong, formatEventTime, formatTimeRangeCompact } from '../utils/format';
import { InfoRow, InfoTable } from './InfoRow';
import { Block } from './Block';

const AGE_LABEL = { all_ages: 'All ages', '18+': '18 and over', '21+': '21 and over, ID required' } as const;

/**
 * When, doors, where, age — the four facts a guest checks on the way out
 * of the house. Text, always: a client with images off still shows them.
 */
export function EventDetails({ event, surface, padded = true }: { event: EmailEvent; surface: Surface; padded?: boolean }) {
  return (
    <Block className={padded ? 'o-gutter' : undefined} style={{ padding: padded ? `4px ${GUTTER}px` : 0 }}>
      <InfoTable>
        <InfoRow label="Date" surface={surface}>
          {formatEventDateLong(event.startsAt)}
        </InfoRow>
        <InfoRow label="Time" surface={surface}>
          {formatTimeRangeCompact(event.startsAt, event.endsAt)}
        </InfoRow>
        {event.doorsAt ? (
          <InfoRow label="Doors" surface={surface}>
            {formatEventTime(event.doorsAt)}
          </InfoRow>
        ) : null}
        <InfoRow label="Where" surface={surface} href={event.venue.directionsUrl} last={!event.agePolicy}>
          {event.venue.name}
          <br />
          {event.venue.address}
        </InfoRow>
        {event.agePolicy ? (
          <InfoRow label="Age" surface={surface} last>
            {AGE_LABEL[event.agePolicy]}
          </InfoRow>
        ) : null}
      </InfoTable>
    </Block>
  );
}
