import { describe, expect, it } from 'vitest';
import * as f from '@/emails/fixtures';
import { isAuthHookPayload, planAuthEmail, supabaseVerifyUrl, type AuthHookPayload } from './auth-hook';
import { signStandardWebhook, svixHeaders, standardHeaders, verifyStandardWebhook } from './webhook-signature';



const SECRET = `whsec_${Buffer.from('a-very-secret-key-for-tests').toString('base64')}`;

describe('standard webhook signatures', () => {
  const body = '{"type":"email.delivered","data":{"email_id":"abc"}}';
  const now = new Date('2026-09-18T12:00:00Z');
  const timestamp = String(Math.floor(now.getTime() / 1000));

  it('accepts a correctly signed request, with either header naming', () => {
    const signature = signStandardWebhook(body, 'msg_1', timestamp, SECRET);
    const svix = svixHeaders((name) => ({ 'svix-id': 'msg_1', 'svix-timestamp': timestamp, 'svix-signature': signature })[name] ?? null);
    expect(verifyStandardWebhook(body, svix, SECRET, now)).toEqual({ ok: true });
    const standard = standardHeaders((name) => ({ 'webhook-id': 'msg_1', 'webhook-timestamp': timestamp, 'webhook-signature': signature })[name] ?? null);
    // Supabase prefixes its secret with `v1,`.
    expect(verifyStandardWebhook(body, standard, `v1,${SECRET}`, now)).toEqual({ ok: true });
  });

  it('accepts a header carrying several signatures if one matches', () => {
    const signature = signStandardWebhook(body, 'msg_1', timestamp, SECRET);
    const headers = { id: 'msg_1', timestamp, signature: `v1,bm90LXRoaXMtb25l ${signature}` };
    expect(verifyStandardWebhook(body, headers, SECRET, now).ok).toBe(true);
  });

  it('rejects a tampered body, a wrong secret, a stale timestamp and missing headers', () => {
    const signature = signStandardWebhook(body, 'msg_1', timestamp, SECRET);
    const headers = { id: 'msg_1', timestamp, signature };
    expect(verifyStandardWebhook(`${body} `, headers, SECRET, now).ok).toBe(false);
    expect(verifyStandardWebhook(body, headers, `whsec_${Buffer.from('other').toString('base64')}`, now).ok).toBe(false);
    expect(verifyStandardWebhook(body, headers, SECRET, new Date(now.getTime() + 10 * 60_000))).toEqual({ ok: false, reason: 'timestamp outside tolerance' });
    expect(verifyStandardWebhook(body, { ...headers, signature: null }, SECRET, now)).toEqual({ ok: false, reason: 'missing signature headers' });
  });
});

describe('the Supabase auth email hook', () => {
  const context = { brand: f.brand, supabaseUrl: 'https://proj.supabase.co', siteUrl: 'https://cosa-nostra.example.com' };

  function payload(action: string, extra: Partial<AuthHookPayload['user']> = {}): AuthHookPayload {
    return {
      user: { id: 'u1', email: 'alex@example.com', user_metadata: { name: 'Nico Moretti', invited_by: 'Alessandro' }, ...extra },
      email_data: { token: '123456', token_hash: 'hash_abc', redirect_to: 'https://cosa-nostra.example.com/auth/activate', email_action_type: action, site_url: 'https://cosa-nostra.example.com' },
    };
  }

  it('recognises the payload shape', () => {
    expect(isAuthHookPayload(payload('invite'))).toBe(true);
    expect(isAuthHookPayload({ user: {} })).toBe(false);
    expect(isAuthHookPayload(null)).toBe(false);
  });

  it('builds the same verify link Supabase’s own templates use', () => {
    const url = supabaseVerifyUrl('https://proj.supabase.co', 'hash_abc', 'magiclink', 'https://cosa-nostra.example.com/auth/callback');
    expect(url).toBe('https://proj.supabase.co/auth/v1/verify?token=hash_abc&type=magiclink&redirect_to=https%3A%2F%2Fcosa-nostra.example.com%2Fauth%2Fcallback');
  });

  it('maps an invitation to the staff invitation, with role and inviter', () => {
    const plan = planAuthEmail(payload('invite'), { ...context, role: 'admin', invitedBy: 'Alessandro' });
    expect(plan.template).toBe('staff_invitation');
    if (plan.template !== 'staff_invitation') return;
    expect(plan.props.role).toBe('Manager');
    expect(plan.props.invitedBy).toBe('Alessandro');
    expect(plan.props.name).toBe('Nico Moretti');
    expect(plan.props.acceptUrl).toContain('type=invite');
    expect(plan.props.acceptUrl).toContain(encodeURIComponent('https://cosa-nostra.example.com/auth/activate'));
  });

  it('maps the sign-in link, the password reset and the confirmations', () => {
    expect(planAuthEmail(payload('magiclink'), context).template).toBe('magic_link');
    expect(planAuthEmail(payload('recovery'), context).template).toBe('password_reset');
    expect(planAuthEmail(payload('signup'), context).template).toBe('verify_email');
    expect(planAuthEmail(payload('email_change'), context).template).toBe('verify_email');
    const unknown = planAuthEmail(payload('reauthentication'), context);
    expect(unknown.template).toBeNull();
  });

  it('falls back to the site callback when no redirect is given', () => {
    const plan = planAuthEmail(payload('magiclink'), context);
    if (plan.template !== 'magic_link') throw new Error('wrong template');
    expect(plan.props.actionUrl).toContain('redirect_to=https%3A%2F%2Fcosa-nostra.example.com%2Fauth%2Factivate');
    const bare = { ...payload('magiclink'), email_data: { ...payload('magiclink').email_data, redirect_to: '' } };
    const fallback = planAuthEmail(bare, context);
    if (fallback.template !== 'magic_link') throw new Error('wrong template');
    expect(fallback.props.actionUrl).toContain(encodeURIComponent('https://cosa-nostra.example.com/auth/callback'));
  });
});
