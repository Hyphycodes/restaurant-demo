import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',

  experimental: {
    serverActions: {
      bodySizeLimit: '26mb',
    },
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    // Staff uploads are stored in Cosa Nostra's own Supabase media bucket.
    remotePatterns: [],
  },

  async redirects() {
    return [
      // Legacy Wix routes -> new equivalents. See PLAN.md §2.
      { source: '/menus', destination: '/menu', permanent: true },
      // The three menus are one page now. These keep every inbound link and
      // indexed URL working, landing on the right tab via the hash.
      { source: '/menu/cocktails', destination: '/menu#cocktails', permanent: true },
      { source: '/menu/brunch', destination: '/menu', permanent: true },
      { source: '/menu/food', destination: '/menu', permanent: true },
      { source: '/event-list', destination: '/events', permanent: true },
      { source: '/join-our-team', destination: '/careers', permanent: true },
      // Orphan Wix Stores route: nothing was ever sold through it.
      { source: '/cart-page', destination: '/', permanent: true },
      // Wix event-detail slugs carry a trailing date segment (…-2026-08-14-22-00).
      // Strip it so every occurrence of a series lands on the series page.
      {
        source: '/event-details/:slug(.*)-:y(\\d{4})-:m(\\d{2})-:d(\\d{2})-:hh(\\d{2})-:mm(\\d{2})',
        destination: '/events/:slug',
        permanent: true,
      },
      { source: '/event-details/:slug', destination: '/events/:slug', permanent: true },
      // The staff app's schedule used to be two destinations — "Schedule" for
      // your own shifts and "Build schedule" under a Manage menu for everyone
      // else's. It is one route now, which decides what to show from what the
      // account may do. These keep every bookmark and old notification working.
      { source: '/staff/operations/schedule', destination: '/staff/schedule', permanent: false },
      { source: '/staff/operations/schedule/new', destination: '/staff/schedule', permanent: false },
      { source: '/staff/operations/schedule/shift/:id', destination: '/staff/schedule?edit=:id', permanent: false },
      { source: '/staff/operations/coverage', destination: '/staff/schedule/coverage', permanent: false },
      // Emails became its own admin section; these were its addresses for a day.
      { source: '/admin/communications', destination: '/admin/emails/sending', permanent: false },
      { source: '/admin/communications/gallery', destination: '/admin/emails', permanent: false },
      { source: '/admin/communications/preview', destination: '/admin/emails/preview', permanent: false },
    ];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // The door scanner at /admin/scan needs the camera; nothing else does.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
