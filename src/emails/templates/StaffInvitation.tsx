import { Text } from '@react-email/components';
import { AccountShell, accountBody } from '../components/AccountShell';
import type { StaffInvitationProps } from '../types';
import { firstNameOf } from '../utils/format';
import { footerLines, joinText } from '../utils/text';



const ROLE_LINE = {
  Owner: 'Owner — everything, including staff accounts and connected services.',
  Manager: 'Manager — edit and publish the menu, events, pages and photos; run the door and the sales screens.',
  Contributor: 'Contributor — edit and save drafts for a manager to publish.',
} as const;

export function subject({ brand, invitedBy }: StaffInvitationProps): string {
  return invitedBy ? `${invitedBy} added you to the ${brand.shortName} admin` : `You’ve been added to the ${brand.shortName} admin`;
}

function expiry({ expiresInHours }: StaffInvitationProps): string {
  return expiresInHours ? `This link works once and expires in ${expiresInHours} hours. ` : 'This link works once. ';
}

export function preheader(props: StaffInvitationProps): string {
  return `Accept your invitation to manage the ${props.brand.shortName} website${props.role ? ` as a ${props.role}` : ''}.`;
}

export function text(props: StaffInvitationProps): string {
  const { brand, name, role, invitedBy, acceptUrl, email } = props;
  return joinText(
    firstNameOf(name) ? `Hi ${firstNameOf(name)},` : null,
    `${invitedBy ?? 'The owner'} added you to the ${brand.shortName} admin — the place the menu, events, tickets and website are managed.`,
    role ? `Your role: ${ROLE_LINE[role]}` : null,
    `Accept the invitation and sign in: ${acceptUrl}`,
    `${expiry(props)}It was sent to ${email}. If you were not expecting it, ignore this email — nothing happens unless the link is opened.`,
    `After that, sign in any time at ${brand.siteUrl}/admin/login with your email. No password to remember: we email you a link.`,
    footerLines(brand),
  );
}

export default function StaffInvitation(props: StaffInvitationProps) {
  const { brand, name, role, invitedBy, acceptUrl, email, test } = props;
  const first = firstNameOf(name);
  return (
    <AccountShell
      brand={brand}
      preview={preheader(props)}
      eyebrow="Staff invitation"
      headline={`Welcome to the ${brand.shortName} team.`}
      greeting={first ? `Hi ${first},` : null}
      actionUrl={acceptUrl}
      actionLabel="Accept invitation"
      test={test}
      security={`${expiry(props)}It was sent to ${email}. If you were not expecting it, ignore this email — nothing happens unless the link is opened.`}
      footerReason={`Sent to ${email} because a staff account was created for it.`}
    >
      <Text style={accountBody}>
        {invitedBy ?? 'The owner'} added you to the {brand.shortName} admin — where the menu, events, tickets and website are managed.
      </Text>
      {role ? (
        <Text style={{ ...accountBody, marginTop: 12 }}>
          <strong>Your role:</strong> {ROLE_LINE[role]}
        </Text>
      ) : null}
      <Text style={{ ...accountBody, marginTop: 12 }}>
        Accept below to confirm your email and sign in. After that, sign in any time from the staff page with just your email — we send you a link, so there is no password to remember.
      </Text>
    </AccountShell>
  );
}
