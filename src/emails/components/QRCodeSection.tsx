import { Img, Text } from '@react-email/components';
import { COLORS, FONTS, QR_SIZE, RADIUS } from '../theme';

/**
 * The QR on a solid white block.
 *
 * White behind it always, whatever the surface: a dark-mode client that
 * inverts the page would otherwise invert the code, and scanners read a
 * dark-on-light code far more reliably. The human code is set beneath in
 * monospace so a dead camera, a cracked screen or a printout still works.
 */
export function QRCodeSection({ src, code, size = QR_SIZE }: { src: string | null; code: string; size?: number }) {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0} style={{ margin: '0 auto' }}>
      <tbody>
        <tr>
          <td align="center" style={{ backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: src ? 14 : '18px 22px' }}>
            {src ? (
              <Img src={src} alt={`QR code for ticket ${code}`} width={size} height={size} style={{ display: 'block', width: size, height: size }} />
            ) : null}
            <Text
              style={{
                margin: src ? '10px 0 0' : 0,
                fontFamily: FONTS.mono,
                fontSize: src ? 20 : 24,
                lineHeight: '26px',
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: COLORS.obsidian,
                textAlign: 'center',
              }}
            >
              {code}
            </Text>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
