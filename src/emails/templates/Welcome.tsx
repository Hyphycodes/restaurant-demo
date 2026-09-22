import { Text } from '@react-email/components';
import { AccountShell, accountBody } from '../components/AccountShell';
import type { AccountEmailProps } from '../types';
import { firstNameOf } from '../utils/format';
import { footerLines, joinText } from '../utils/text';

/**
 * After an invitation is accepted. Template only for now: there is no
 * customer account to welcome anyone to, and staff get the invitation.
 * Kept so the day customer accounts exist, the email already does.
 */

export function subject({ brand }: AccountEmailProps): string {
  return `Welcome to ${brand.shortName}`;
}

export function preheader(props: AccountEmailProps): string {
  return `Your ${props.brand.shortName} account is ready.`;
}

export function text(props: AccountEmailProps): string {
  const { brand, name, actionUrl } = props;
  return joinText(
    firstNameOf(name) ? `Hi ${firstNameOf(name)},` : null,
    `Your ${brand.shortName} account is ready. Your tickets, past and future, will always be at ${actionUrl}.`,
    footerLines(brand),
  );
}

export default function Welcome(props: AccountEmailProps) {
  const { brand, name, actionUrl, email, test } = props;
  const first = firstNameOf(name);
  return (
    <AccountShell
      brand={brand}
      preview={preheader(props)}
      eyebrow="Welcome"
      headline={`Welcome to ${brand.shortName}.`}
      greeting={first ? `Hi ${first},` : null}
      actionUrl={actionUrl}
      actionLabel="Open your account"
      test={test}
      security={`Sent to ${email}. You can sign in any time with just your email — we send you a link.`}
      footerReason={`Sent to ${email} because an account was created for it.`}
    >
      <Text style={accountBody}>Your account is ready. Your tickets, past and future, will always be one tap away.</Text>
    </AccountShell>
  );
}
