import { StaffShell, staffText } from '../../components/StaffShell';
import type { StaffEmailProps } from '../../types';



export function subject({ headline }: StaffEmailProps): string {
  return `New at Casa Aurelia: ${headline}`;
}

export function text(props: StaffEmailProps): string {
  return staffText(props);
}

export default function SubmissionAlert(props: StaffEmailProps) {
  return <StaffShell eyebrow="Inbox" props={props} />;
}
