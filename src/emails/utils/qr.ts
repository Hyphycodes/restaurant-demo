import QRCode from 'qrcode';

/**
 * A QR as an SVG data URL, synchronously.
 *
 * Previews need a QR without an `await` — React Email preview files are
 * plain components with static props — and the admin preview inlines one
 * without attaching anything. `qrcode` exposes the module matrix
 * synchronously; drawing it as one `<path>` is a few lines and needs no
 * record.
 *
 * SENT email never uses this. Gmail strips data URLs and most clients will
 * not render SVG, so a real send attaches a PNG and references it by `cid:`
 * (see `src/server/email/service.ts`). Same payload, different carrier.
 */
export function qrSvg(payload: string, options: { size?: number; margin?: number; dark?: string; light?: string } = {}): string {
  const { size = 220, margin = 2, dark = '#000000', light = '#ffffff' } = options;
  const qr = QRCode.create(payload, { errorCorrectionLevel: 'H' });
  const count = qr.modules.size;
  const total = count + margin * 2;
  let path = '';
  for (let y = 0; y < count; y += 1) {
    let run = 0;
    for (let x = 0; x <= count; x += 1) {
      const on = x < count && qr.modules.get(y, x) === 1;
      if (on) {
        run += 1;
        continue;
      }
      if (run > 0) {
        path += `M${x - run + margin} ${y + margin}h${run}v1h-${run}z`;
        run = 0;
      }
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="${light}"/>` +
    `<path d="${path}" fill="${dark}"/>` +
    `</svg>`
  );
}

export function qrSvgDataUrl(payload: string, options?: Parameters<typeof qrSvg>[1]): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg(payload, options))}`;
}
