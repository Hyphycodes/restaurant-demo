import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AdminShell, NoAccess } from '@/components/admin/AdminShell';
import { Card, EmptyState, Notice } from '@/components/admin/ui';
import { getReadDb, isLocalDb } from '@/lib/db';
import { getStaff, staffCan } from '@/server/auth';
import { listVersions } from '@/server/content/editorial';
import { getMedia, getMediaLibrary, mediaProblems } from '@/server/content/media';
import { canOpen } from '@/server/permissions';
import { MediaDetails } from './MediaDetails';

export const dynamic = 'force-dynamic';

export default async function MediaDetailPage({ params }: { params: Promise<{ asset: string }> }) {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');

  const local = isLocalDb();
  if (!canOpen({ role: staff.role, sections: staff.sections }, 'media')) {
    return (
      <AdminShell staff={staff} local={local} title="Photos & videos">
        <NoAccess what="photos and videos" />
      </AdminShell>
    );
  }

  const { asset: assetId } = await params;
  const db = getReadDb();
  if (!db) notFound();

  const entry = await getMedia(db, assetId);
  if (!entry) notFound();

  const library = await getMediaLibrary(db);
  const alternatives = library
    .filter(
      (other) =>
        other.assetId !== assetId &&
        other.kind === entry.kind &&
        other.path &&
        !other.archivedAt,
    )
    .map((other) => ({ id: other.assetId, label: other.title }));

  const problems = mediaProblems(entry);
  const versions = await listVersions(db, 'media_assets', assetId);

  return (
    <AdminShell
      staff={staff}
      local={local}
      title={entry.title}
      description={entry.kind === 'video' ? 'Video' : 'Photo'}
      backTo={{ href: '/admin/media', label: 'All photos & videos' }}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
        <div className="grid gap-4">
          <div className="overflow-hidden rounded-(--radius-md) border border-brown/20 bg-ivory-deep">
            {entry.path && entry.kind === 'video' ? (
              <video
                src={entry.path}
                poster={entry.poster ?? undefined}
                controls
                playsInline
                preload="metadata"
                className="aspect-square w-full bg-espresso object-contain"
              />
            ) : entry.path ? (
              <div className="relative aspect-square w-full">
                <Image
                  src={entry.path}
                  alt={entry.alt ?? ''}
                  fill
                  sizes="(min-width: 1024px) 22rem, 90vw"
                  className="object-contain"
                />
              </div>
            ) : (
              <div className="flex aspect-square items-center justify-center text-[0.875rem] text-brown-soft">
                No file yet
              </div>
            )}
          </div>

          {problems.length > 0 ? (
            <Notice tone="danger">{problems.join(' ')}</Notice>
          ) : null}

          <Card title="Where it is used" tone="quiet">
            {entry.usage.length === 0 && entry.registryUsage.length === 0 ? (
              <EmptyState>Not used anywhere on the website right now.</EmptyState>
            ) : null}

            {entry.usage.length > 0 ? (
              <ul className="grid gap-2">
                {entry.usage.map((use) => (
                  <li key={`${use.href}-${use.label}`} className="text-[0.875rem]">
                    <Link href={use.href} className="font-medium text-clay underline underline-offset-4">
                      {use.label}
                    </Link>
                    <span className="text-brown-soft"> · appears on {use.route}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {entry.registryUsage.length > 0 ? (
              <div className={entry.usage.length > 0 ? 'mt-4 border-t border-brown/12 pt-3' : ''}>
                <p className="text-[0.8125rem] font-semibold text-brown">Used automatically</p>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-brown-soft">
                  This appears on {entry.registryUsage.join(', ')}. You can replace it below and the
                  website keeps the right size and crop automatically.
                </p>
              </div>
            ) : null}
          </Card>
        </div>

        <MediaDetails
          entry={entry}
          alternatives={alternatives}
          versions={versions}
          canArchive={staffCan(staff, 'content.archive')}
          canRestore={staffCan(staff, 'content.restore')}
        />
      </div>
    </AdminShell>
  );
}
