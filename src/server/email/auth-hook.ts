import type { TemplateId } from '@/emails/registry';
import type { AccountEmailProps, EmailBrand, StaffInvitationProps, StaffRoleLabel } from '@/emails/types';



export interface AuthHookPayload {
  user: { id: string; email: string; user_metadata?: Record<string, unknown> | null; app_metadata?: Record<string, unknown> | null };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

export type AuthEmailPlan =
  | { template: 'staff_invitation'; props: StaffInvitationProps; to: string }
  | { template: 'magic_link' | 'password_reset' | 'verify_email'; props: AccountEmailProps; to: string };

export function isAuthHookPayload(value: unknown): value is AuthHookPayload {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const user = v.user as Record<string, unknown> | undefined;
  const data = v.email_data as Record<string, unknown> | undefined;
  return Boolean(user && typeof user.email === 'string' && data && typeof data.token_hash === 'string' && typeof data.email_action_type === 'string');
}

/** The verify link Supabase's own templates use, for our own email to carry. */
export function supabaseVerifyUrl(supabaseUrl: string, tokenHash: string, actionType: string, redirectTo: string): string {
  const url = new URL('/auth/v1/verify', supabaseUrl);
  url.searchParams.set('token', tokenHash);
  url.searchParams.set('type', actionType);
  url.searchParams.set('redirect_to', redirectTo);
  return url.toString();
}

const ROLE_LABEL: Record<string, StaffRoleLabel> = { owner: 'Owner', admin: 'Manager', editor: 'Contributor' };

export function planAuthEmail(
  payload: AuthHookPayload,
  context: { brand: EmailBrand; supabaseUrl: string; siteUrl: string; role?: string | null; invitedBy?: string | null; expiresInMinutes?: number | null },
): AuthEmailPlan | { template: null; reason: string } {
  const { user, email_data: data } = payload;
  const name = typeof user.user_metadata?.name === 'string' ? (user.user_metadata.name as string) : null;
  const action = data.email_action_type;
  const redirect = data.redirect_to || `${context.siteUrl}/auth/callback`;
  const actionUrl = supabaseVerifyUrl(context.supabaseUrl, data.token_hash, action, redirect);
  const expires = context.expiresInMinutes ?? 60;
  const base = { brand: context.brand, name, email: user.email, expiresInMinutes: expires };

  switch (action) {
    case 'invite':
      return {
        template: 'staff_invitation',
        to: user.email,
        props: {
          brand: context.brand,
          name,
          email: user.email,
          role: context.role ? (ROLE_LABEL[context.role] ?? null) : null,
          invitedBy: context.invitedBy ?? null,
          acceptUrl: supabaseVerifyUrl(context.supabaseUrl, data.token_hash, action, data.redirect_to || `${context.siteUrl}/auth/activate`),
          expiresInHours: Math.max(1, Math.round(expires / 60)),
        },
      };
    case 'magiclink':
      return { template: 'magic_link', to: user.email, props: { ...base, actionUrl } };
    case 'recovery':
      return { template: 'password_reset', to: user.email, props: { ...base, actionUrl } };
    case 'signup':
    case 'email_change':
      return { template: 'verify_email', to: user.email, props: { ...base, actionUrl } };
    case 'email_change_current':
      // The confirmation sent to the OLD address. Same template; the link confirms the change.
      return { template: 'verify_email', to: user.email, props: { ...base, actionUrl } };
    default:
      return { template: null, reason: `unsupported email_action_type: ${action}` };
  }
}

export const AUTH_TEMPLATES: TemplateId[] = ['staff_invitation', 'magic_link', 'password_reset', 'verify_email'];
