import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HubRenderer } from '@/components/link-hubs/HubRenderer';
import { getDefaultPublicHub } from '@/server/content/link-hubs';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Cosa Nostra Links — Cosa Nostra',
  description: 'Events, reservations, menu and more from Cosa Nostra.',
  alternates: { canonical: '/links' },
  robots: { index: false, follow: true },
};

export default async function LinksPage() {
  const page = await getDefaultPublicHub();
  if (!page) notFound();
  return <HubRenderer page={page} />;
}
