import type { Metadata, Viewport } from 'next';
import '../admin/admin.css';
import './staff.css';

export const metadata: Metadata = {
  title: { default: 'Casa Aurelia Staff', template: '%s · Casa Aurelia Staff' },
  // The staff app must never appear in search results.
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: '#160d07',
  colorScheme: 'dark',
  // A form field that zooms the page on focus is the single most common
  // "the app feels broken" report on a phone.
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

/**
 * The staff app is a separate route subtree with its own shell, so none of
 * the admin's screens are reachable from it and none of its code is bundled
 * into a public page. The shared root layout supplies <html>, <body> and
 * the fonts; this layout supplies the night.
 */
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-admin-look="evening" data-staff className="min-h-dvh bg-ivory text-brown">
      {children}
    </div>
  );
}
