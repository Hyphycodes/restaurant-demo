import { StaffShell, staffText } from '../../components/StaffShell';
import type { StaffEmailProps } from '../../types';

/** You are working an event. One of the seven staff operations emails; see StaffShell. */

export function subject({ brand, headline }: StaffEmailProps): string {
  return `${headline} · ${brand.shortName}`;
}

export function text(props: StaffEmailProps): string {
  return staffText(props);
}

export default function EventAssignment(props: StaffEmailProps) {
  return <StaffShell eyebrow="Event" props={props} />;
}
