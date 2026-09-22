import QRCode from 'qrcode';

/**
 * A QR as a PNG, built for phones held up to phones.
 *
 * ~600px, high error correction, a solid white quiet zone: these get
 * screenshotted, zoomed, photographed off another screen and shown at 30%
 * brightness in a dark room. `wallet.ts` will sit beside this file later.
 */
export async function ticketQrPng(payload: string): Promise<Buffer> {
  return QRCode.toBuffer(payload, {
    type: 'png',
    errorCorrectionLevel: 'H',
    width: 600,
    margin: 2,
    color: { dark: '#000000ff', light: '#ffffffff' },
  });
}

/** The same, as a data URL, for inlining in an email or a page. */
export async function ticketQrDataUrl(payload: string, width = 320): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'H',
    width,
    margin: 2,
    color: { dark: '#000000ff', light: '#ffffffff' },
  });
}
