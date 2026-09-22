import { NextResponse } from 'next/server';
import { getStaff, staffCan } from '@/server/auth';
import { contentTypeOf, isSubmissionPath, readLocalUpload, signedUploadUrl } from '@/server/uploads';

export const dynamic = 'force-dynamic';

/**
 * The one way a résumé or a talent photograph is ever seen.
 *
 * The `applications` bucket is private, so there is no URL anybody can share,
 * guess or leave in a browser history that still works tomorrow. This route
 * checks the signed-in staff member first, then either redirects to a
 * five-minute signed URL (Supabase) or streams the local development copy.
 *
 * Three refusals, in order: not signed in, not allowed, not one of our own
 * object paths. The last one matters most — it is what stops `../` and a
 * guessed bucket key from turning a staff session into a file browser.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const staff = await getStaff();
  if (!staff) return new NextResponse('Sign in first.', { status: 401 });
  if (!staffCan(staff, 'inquiries.manage')) {
    return new NextResponse('Your account cannot open these.', { status: 403 });
  }

  const { path } = await params;
  const object = path.join('/');
  if (!isSubmissionPath(object)) return new NextResponse('Not found.', { status: 404 });

  const signed = await signedUploadUrl(object);
  if (signed) return NextResponse.redirect(signed);

  const local = await readLocalUpload(object);
  if (local) {
    return new NextResponse(new Uint8Array(local), {
      headers: {
        'Content-Type': contentTypeOf(object),
        // Private, and never stored by a shared cache.
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'inline',
      },
    });
  }

  return new NextResponse('That file is not available.', { status: 404 });
}
