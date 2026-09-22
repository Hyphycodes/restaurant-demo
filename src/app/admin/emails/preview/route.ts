import { NextResponse, type NextRequest } from 'next/server';
import { isTemplateId } from '@/emails/registry';
import { getStaff } from '@/server/auth';
import { emailService } from '@/server/email/service';
import { canOpen } from '@/server/permissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /admin/emails/preview?template=…&variant=…&event=…
 *
 * The rendered email, as HTML, for the frames on the Emails
 * screens. Real event data, fixture people, and the QR attachments the real
 * send would carry are inlined as data URLs so the preview shows them.
 * Staff only; never indexed; never sends anything.
 */
export async function GET(request: NextRequest) {
  const staff = await getStaff();
  if (!staff || !canOpen({ role: staff.role, sections: staff.sections }, 'events')) {
    return new NextResponse('Sign in to preview emails.', { status: 401, headers: { 'content-type': 'text/plain' } });
  }
  const params = request.nextUrl.searchParams;
  const template = params.get('template') ?? '';
  if (!isTemplateId(template)) return new NextResponse('Unknown template.', { status: 404, headers: { 'content-type': 'text/plain' } });

  const preview = await emailService.renderPreview({ templateId: template, variant: params.get('variant'), eventId: params.get('event'), test: params.get('test') === '1' });
  if ('error' in preview) {
    // Status 200 with a header rather than a 4xx: the iframe on Communications
    // shows the sentence, and the gallery reads `x-email-error` to label the
    // card instead of scraping it back out of the markup.
    return new NextResponse(`<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:24px;color:#6a3f05;background:#fbf6ea">${escape(preview.error)}</body>`, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'x-email-error': encodeURIComponent(preview.error) },
    });
  }
  let html = preview.rendered.html;
  for (const attachment of preview.attachments) {
    if (attachment.contentId) html = html.replaceAll(`cid:${attachment.contentId}`, `data:${attachment.contentType};base64,${attachment.content.toString('base64')}`);
  }
  if (params.get('format') === 'text') {
    return new NextResponse(`${preview.rendered.subject}\n\n${preview.rendered.text}`, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
  }
  return new NextResponse(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'x-email-subject': encodeURIComponent(preview.rendered.subject) },
  });
}

function escape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
