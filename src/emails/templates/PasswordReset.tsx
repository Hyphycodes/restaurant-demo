import { Text } from '@react-email/components';
import { AccountShell, accountBody } from '../components/AccountShell';
import type { AccountEmailProps } from '../types';
import { firstNameOf } from '../utils/format';
import { footerLines, joinText } from '../utils/text';

/** Only for the password fallback on the staff sign-in page. */

export function subject({ brand }: AccountEmailProps): string {
  return `Reset your ${brand.shortName} admin password`;
}

function expiry({ expiresInMinutes }: AccountEmailProps): string {
  return expiresInMinutes ? `This link works once and expires in ${expiresInMinutes} minutes.` : 'This link works once.';
}

export function preheader(props: AccountEmailProps): string {
  return `Choose a new password for the ${props.brand.shortName} admin. ${expiry(props)}`;
}

export function text(props: AccountEmailProps): string {
  const { brand, name, actionUrl, email } = props;
  return joinText(
    firstNameOf(name) ? `Hi ${firstNameOf(name)},` : null,
    `Choose a new password for the ${brand.shortName} admin: ${actionUrl}`,
    `${expiry(props)} It was requested for ${email}. If you did not ask for this, ignore it — your password stays as it is.`,
    footerLines(brand),
  );
}

export default function PasswordReset(props: AccountEmailProps) {
  const { brand, name, actionUrl, email, test } = props;
  const first = firstNameOf(name);
  return (
    <AccountShell
      brand={brand}
      preview={preheader(props)}
      eyebrow="Password reset"
      headline="Choose a new password."
      greeting={first ? `Hi ${first},` : null}
      actionUrl={actionUrl}
      actionLabel="Reset password"
      test={test}
      security={`${expiry(props)} It was requested for ${email}. If you did not ask for this, ignore it — your password stays as it is.`}
      footerReason={`Sent to ${email} because a password reset was requested.`}
    >
      <Text style={accountBody}>Somebody asked to reset the password on your {brand.shortName} admin account. Tap below to choose a new one.</Text>
      <Text style={{ ...accountBody, marginTop: 12 }}>Most of the team never needs a password: the sign-in page can email you a link instead.</Text>
    </AccountShell>
  );
}
