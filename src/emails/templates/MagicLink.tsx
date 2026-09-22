import { Text } from '@react-email/components';
import { AccountShell, accountBody } from '../components/AccountShell';
import type { AccountEmailProps } from '../types';
import { firstNameOf } from '../utils/format';
import { footerLines, joinText } from '../utils/text';

/** The passwordless sign-in link for staff. */

export function subject({ brand }: AccountEmailProps): string {
  return `Your ${brand.shortName} sign-in link`;
}

function expiry({ expiresInMinutes }: AccountEmailProps): string {
  return expiresInMinutes ? `This link works once and expires in ${expiresInMinutes} minutes.` : 'This link works once.';
}

export function preheader(props: AccountEmailProps): string {
  return `Tap to sign in to the ${props.brand.shortName} admin. ${expiry(props)}`;
}

export function text(props: AccountEmailProps): string {
  const { brand, name, actionUrl, email } = props;
  return joinText(
    firstNameOf(name) ? `Hi ${firstNameOf(name)},` : null,
    `Here is your sign-in link for the ${brand.shortName} admin: ${actionUrl}`,
    `${expiry(props)} Open it in the browser you asked from. It was requested for ${email}; if that was not you, ignore this email.`,
    footerLines(brand),
  );
}

export default function MagicLink(props: AccountEmailProps) {
  const { brand, name, actionUrl, email, test } = props;
  const first = firstNameOf(name);
  return (
    <AccountShell
      brand={brand}
      preview={preheader(props)}
      eyebrow="Sign in"
      headline="Your sign-in link."
      greeting={first ? `Hi ${first},` : null}
      actionUrl={actionUrl}
      actionLabel={`Sign in to ${brand.shortName} admin`}
      test={test}
      security={`${expiry(props)} Open it in the browser you asked from. It was requested for ${email}; if that was not you, ignore this email and nothing will happen.`}
      footerReason={`Sent to ${email} because a sign-in link was requested.`}
    >
      <Text style={accountBody}>Tap the button to sign in to the {brand.shortName} admin. No password needed.</Text>
    </AccountShell>
  );
}
