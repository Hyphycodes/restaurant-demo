import { Text } from '@react-email/components';
import { AccountShell, accountBody } from '../components/AccountShell';
import type { AccountEmailProps } from '../types';
import { firstNameOf } from '../utils/format';
import { footerLines, joinText } from '../utils/text';

/** Confirm an address: a new account, or a changed email on an existing one. */

export function subject({ brand }: AccountEmailProps): string {
  return `Confirm your email for ${brand.shortName}`;
}

function expiry({ expiresInMinutes }: AccountEmailProps): string {
  return expiresInMinutes ? `This link works once and expires in ${expiresInMinutes} minutes.` : 'This link works once.';
}

export function preheader(props: AccountEmailProps): string {
  return `One tap to confirm ${props.email}. ${expiry(props)}`;
}

export function text(props: AccountEmailProps): string {
  const { brand, name, actionUrl, email } = props;
  return joinText(
    firstNameOf(name) ? `Hi ${firstNameOf(name)},` : null,
    `Confirm ${email} for your ${brand.shortName} account: ${actionUrl}`,
    `${expiry(props)} If you did not create this account, ignore this email.`,
    footerLines(brand),
  );
}

export default function VerifyEmail(props: AccountEmailProps) {
  const { brand, name, actionUrl, email, test } = props;
  const first = firstNameOf(name);
  return (
    <AccountShell
      brand={brand}
      preview={preheader(props)}
      eyebrow="Confirm your email"
      headline="One tap to confirm."
      greeting={first ? `Hi ${first},` : null}
      actionUrl={actionUrl}
      actionLabel="Confirm email"
      test={test}
      security={`${expiry(props)} If you did not create this account, ignore this email and nothing will happen.`}
      footerReason={`Sent to ${email} to confirm it belongs to you.`}
    >
      <Text style={accountBody}>
        Confirm that <strong>{email}</strong> is yours and your {brand.shortName} account is ready.
      </Text>
    </AccountShell>
  );
}
