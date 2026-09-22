import { StaffShell, staffText } from '../../components/StaffShell';
import type { StaffEmailProps } from '../../types';

/**
 * "We got it, and we will look at your work."
 *
 * The warmest of the three, and the most careful: it promises a look, not a
 * booking. Somebody who sent a mixtape at midnight should not read this and
 * think they have a night.
 */

export function subject({ brand }: StaffEmailProps): string {
  return `We got it — thanks for sending your work · ${brand.shortName}`;
}

export function text(props: StaffEmailProps): string {
  return staffText(props);
}

export default function TalentReceived(props: StaffEmailProps) {
  return <StaffShell eyebrow="Create with us" props={props} />;
}
