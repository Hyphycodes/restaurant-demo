import { NextResponse, type NextRequest } from 'next/server';
import { DEMO_ROLE_COOKIE, DEMO_SESSION_COOKIE } from '@/lib/demo';

export function middleware(request: NextRequest) {
  let session = request.cookies.get(DEMO_SESSION_COOKIE)?.value;
  if (!session || !/^[a-f0-9-]{36}$/.test(session)) session = crypto.randomUUID();
  request.cookies.set(DEMO_SESSION_COOKIE, session);
  const path = request.nextUrl.pathname;
  // Role follows the product being explored. These identities authorize only fictional data.
  const role = path === '/demo/manager' ? 'admin' : path === '/demo/staff' ? 'staff' : path.startsWith('/staff') ? (request.cookies.get(DEMO_ROLE_COOKIE)?.value === 'admin' ? 'admin' : 'staff') : path.startsWith('/admin') || path === '/demo/admin' ? 'owner' : request.cookies.get(DEMO_ROLE_COOKIE)?.value ?? 'owner';
  request.cookies.set(DEMO_ROLE_COOKIE, role);
  if (path.startsWith('/api/webhooks') || path.startsWith('/api/cron') || path.startsWith('/auth/')) {
    return NextResponse.json({ demo: true, error: 'External services are disabled in this fictional demo.' }, {status:403});
  }
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(DEMO_SESSION_COOKIE,session,{httpOnly:true,sameSite:'lax',secure:request.nextUrl.protocol==='https:',path:'/',maxAge:3600});
  response.cookies.set(DEMO_ROLE_COOKIE,role,{httpOnly:true,sameSite:'lax',secure:request.nextUrl.protocol==='https:',path:'/',maxAge:3600});
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.svg|media/|events/.*\\.(?:webp|svg)|art/).*)'] };
