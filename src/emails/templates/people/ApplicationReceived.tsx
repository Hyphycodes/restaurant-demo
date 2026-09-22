import { StaffShell, staffText } from '../../components/StaffShell';
import type { StaffEmailProps } from '../../types';



export function subject({ brand, details }: StaffEmailProps): string {
  const position = details.find((row) => row.label === 'Applied for')?.value;
  return position ? `We got your application — ${position}` : `We got your application · ${brand.shortName}`;
}

export function text(props: StaffEmailProps): string {
  return staffText(props);
}

export default function ApplicationReceived(props: StaffEmailProps) {
  return <StaffShell eyebrow="Work with us" props={props} />;
}
