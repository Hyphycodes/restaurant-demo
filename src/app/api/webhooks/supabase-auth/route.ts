import { NextResponse, type NextRequest } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/site-url';
import { isAuthHookPayload } from '@/server/email/auth-hook';
import { emailConfig } from '@/server/email/config';
import { emailService } from '@/server/email/service';
import { standardHeaders, verifyStandardWebhook } from '@/server/email/webhook-signature';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


export async function POST(request: NextRequest) {
  const secret = process.env.SUPABASE_AUTH_HOOK_SECRET?.trim();
  if (!secret) return hookError(503, 'SUPABASE_AUTH_HOOK_SECRET is not set on the website.');

  const body = await request.text();
  const verified = verifyStandardWebhook(body, standardHeaders((name) => request.headers.get(name)), secret);
  if (!verified.ok) return hookError(401, 'Bad signature.');

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return hookError(400, 'Bad body.');
  }
  if (!isAuthHookPayload(payload)) return hookError(400, 'Unexpected payload.');

  const config = emailConfig();
  if (!config.transportConfigured || !config.from) return hookError(503, config.fromProblem ?? 'Email sending is not configured on the website.');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!supabaseUrl) return hookError(503, 'NEXT_PUBLIC_SUPABASE_URL is not set.');

  // The role, for the invitation's "your role" line. Best effort.
  let role: string | null = null;
  try {
    const service = getServiceClient();
    const { data } = service ? await service.from('profiles').select('role').eq('user_id', payload.user.id).maybeSingle() : { data: null };
    role = (data?.role as string | null) ?? null;
  } catch {
    role = null;
  }
  const invitedBy = typeof payload.user.user_metadata?.invited_by === 'string' ? (payload.user.user_metadata.invited_by as string) : null;

  const result = await emailService.sendAuthEmail(payload, { supabaseUrl, siteUrl: SITE_URL, role, invitedBy });
  if (!result.ok) return hookError(500, result.reason ?? 'The email could not be sent.');
  return NextResponse.json({});
}

function hookError(status: number, message: string) {
  return NextResponse.json({ error: { http_code: status, message } }, { status });
}
