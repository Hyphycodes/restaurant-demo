import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { HubDisplay } from '@/components/link-hubs/HubDisplay';
import { getPublicHub } from '@/server/content/link-hubs';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0D0805' };

export default async function HubDisplayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPublicHub(slug);
  if (!page) notFound();
  return <HubDisplay page={page} />;
}
