import QRCode from 'qrcode';
import { absoluteUrl } from '@/lib/site-url';
import { getHubQrTarget } from '@/server/content/link-hubs';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const target = await getHubQrTarget(slug);
  if (!target) return new Response('Not found', { status: 404 });
  const url = absoluteUrl(`/go/${target}`);
  const png = await QRCode.toBuffer(url, { type: 'png', width: 1200, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#0D0805', light: '#FFFFFF' } });
  const download = new URL(request.url).searchParams.get('download') === '1';
  return new Response(new Uint8Array(png), {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=86400, stale-while-revalidate=604800',
      ...(download ? { 'content-disposition': `attachment; filename="casa-aurelia-${target}-qr.png"` } : {}),
    },
  });
}
