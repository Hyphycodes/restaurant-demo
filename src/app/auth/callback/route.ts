import { NextResponse, type NextRequest } from 'next/server';
import { getServiceClient, getSessionClient } from '@/lib/supabase/server';
import { completeOwnerOnboarding } from '@/server/owner-onboarding';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const client = await getSessionClient();
  if (code && client) {
    const {data,error} = await client.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      try {
        const service = getServiceClient();
        if (service) await completeOwnerOnboarding(service,data.user);
        const {data:profile,error:profileError} = await client.from('profiles').select('active').eq('user_id',data.user.id).maybeSingle();
        if (!profileError && profile?.active !== false && profile) return NextResponse.redirect(new URL('/admin',request.url));
      } catch { /* Keep access closed when onboarding cannot complete. */ }
      await client.auth.signOut();
      return NextResponse.redirect(new URL('/admin/login?error=access',request.url));
    }
  }
  return NextResponse.redirect(new URL('/admin/login?error=link',request.url));
}
