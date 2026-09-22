import { StaffShell, staffText } from '../../components/StaffShell';
import type { StaffEmailProps } from '../../types';

/** New training for you. One of the seven staff operations emails; see StaffShell. */

export function subject({ brand, headline }: StaffEmailProps): string {
  return `${headline} · ${brand.shortName}`;
}

export function text(props: StaffEmailProps): string {
  return staffText(props);
}

export default function TrainingRequired(props: StaffEmailProps) {
  return <StaffShell eyebrow="Training" props={props} />;
}
