import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { HubRenderer } from '@/components/link-hubs/HubRenderer';
import { getPublicHub } from '@/server/content/link-hubs';
import { absoluteUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublicHub(slug);
  if (!page) return {};
  const imageId = page.hub.heroAssetId || page.hub.backgroundAssetId;
  const image = imageId ? page.media[imageId] : null;
  return {
    title: page.hub.title === 'Casa Aurelia' ? 'Links — Casa Aurelia' : `${page.hub.title} — Casa Aurelia`,
    description: page.hub.subtitle || page.hub.internalDescription || 'Casa Aurelia links, events and guest actions.',
    alternates: { canonical: `/go/${page.hub.slug}` },
    robots: page.hub.searchVisibility === 'searchable' ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      type: 'website',
      url: absoluteUrl(`/go/${page.hub.slug}`),
      title: page.hub.title,
      description: page.hub.subtitle || 'Casa Aurelia',
      ...(image?.kind === 'image' ? { images: [{ url: absoluteUrl(image.path), width: image.width, height: image.height, alt: image.alt }] } : {}),
    },
  };
}
export function generateViewport(): Viewport {
  return { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#0D0805' };
}

export default async function LinkHubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPublicHub(slug);
  if (!page) notFound();
  return <HubRenderer page={page} />;
}
