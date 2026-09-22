import { Body, Container, Head, Html, Preview } from '@react-email/components';
import type { ReactNode } from 'react';
import { CONTAINER_WIDTH, FONTS, PALETTE, type Surface } from '../theme';
import type { EmailBrand } from '../types';
import { RestaurantFooter } from './RestaurantFooter';
import { TestBanner } from './TestBanner';
import { Block } from './Block';


export function RestaurantEmailLayout({
  preview,
  surface,
  brand,
  test = false,
  footerReason,
  children,
}: {
  /** The preheader: what the inbox shows after the subject. */
  preview: string;
  surface: Surface;
  brand: EmailBrand;
  test?: boolean;
  /** Why this person is getting the email. One sentence. */
  footerReason?: string;
  children: ReactNode;
}) {
  const palette = PALETTE[surface];
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content={surface === 'dark' ? 'dark' : 'light'} />
        <meta name="supported-color-schemes" content="light dark" />
        <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
        <style>{`
          table { border-collapse: collapse; mso-table-lspace: 0; mso-table-rspace: 0; }
          img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
          a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
          @media (max-width: 620px) {
            .o-gutter { padding-left: 16px !important; padding-right: 16px !important; }
            .o-stack { display: block !important; width: 100% !important; }
            .o-stack-gap { padding-top: 16px !important; padding-left: 0 !important; }
            .o-hide-mobile { display: none !important; }
          }
        `}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, padding: 0, backgroundColor: palette.page, fontFamily: FONTS.sans, WebkitTextSizeAdjust: '100%' }}>
        <Block style={{ backgroundColor: palette.page, padding: '20px 8px' }}>
          <Container
            style={{
              maxWidth: `${CONTAINER_WIDTH}px`,
              width: '100%',
              margin: '0 auto',
              backgroundColor: palette.surface,
              color: palette.text,
              borderRadius: 16,
              overflow: 'hidden',
            }}
          >
            {test ? <TestBanner /> : null}
            {children}
            <RestaurantFooter brand={brand} surface={surface} reason={footerReason} />
          </Container>
        </Block>
      </Body>
    </Html>
  );
}
