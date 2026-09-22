import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // The admin area holds no public content and should never be indexed.
        disallow: ['/admin', '/admin/', '/go/*/display'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
