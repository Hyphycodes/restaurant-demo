import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminShell, NoAccess } from '@/components/admin/AdminShell';
import { SearchField } from '@/components/admin/SearchField';
import { EmptyState, SummaryStrip } from '@/components/admin/ui';
import { getReadDb, isLocalDb } from '@/lib/db';
import { getStaff, staffCan } from '@/server/auth';
import {
  getMediaLibrary,
  MEDIA_TAGS,
  mediaProblems,
  searchMedia,
  totalPlacements,
} from '@/server/content/media';
import { canOpen } from '@/server/permissions';
import { UploadForm } from './UploadForm';

export const dynamic = 'force-dynamic';

/**
 * The photo library.
 *
 * Flat, searchable, with a deliberately small tag list. No folders: a restaurant
 * has a few hundred photographs at most, and nested folders turn "find the bar
 * shot" into an archaeology exercise. Every card says where the photo is used,
 * because that is the question people actually have.
 */
export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; show?: string }>;
}) {
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

  const db = getReadDb();
  const params = await searchParams;
  const library = db ? await getMediaLibrary(db) : [];

  const showArchived = params.show === 'archived';
  let visible = library.filter((entry) => Boolean(entry.archivedAt) === showArchived);
  if (params.tag) visible = visible.filter((entry) => entry.tags.includes(params.tag!));
  visible = searchMedia(visible, params.q ?? '');

  const needsAlt = library.filter(
    (entry) => entry.path && !entry.archivedAt && !entry.decorative && !entry.alt?.trim(),
  );
  const missing = library.filter((entry) => !entry.path && !entry.archivedAt);

  return (
    <AdminShell
      staff={staff}
      local={local}
      title="Photos & videos"
      description="Add a file once, then choose where it appears on the website."
    >
      {!db ? (
        <EmptyState>
          Photos and videos are not available right now. Please try again in a moment.
        </EmptyState>
      ) : (
        <>
          {/* Two problems used to arrive as two full-width alarms, one red and
              one orange, before a single photograph. They are one line now —
              and only descriptions are anybody's job, so only descriptions get
              a way in. */}
          {needsAlt.length > 0 || missing.length > 0 ? (
            <div className="mb-5">
              <SummaryStrip tone={needsAlt.length > 0 ? 'warning' : 'info'}>
                {needsAlt.length > 0 ? (
                  <>
                    <strong className="font-semibold">
                      {needsAlt.length} {needsAlt.length === 1 ? 'file needs' : 'files need'} a
                      description
                    </strong>{' '}
                    so screen readers can describe {needsAlt.length === 1 ? 'it' : 'them'} — open
                    one below and add it.
                  </>
                ) : null}
                {needsAlt.length > 0 && missing.length > 0 ? ' ' : null}
                {missing.length > 0 ? (
                  <>
                    {missing.length} {missing.length === 1 ? 'spot is' : 'spots are'} still waiting
                    for a real photo; a branded placeholder stands in until then, so nothing looks
                    broken.
                  </>
                ) : null}
              </SummaryStrip>
            </div>
          ) : null}

          {staffCan(staff, 'media.upload') ? (
            <div className="mb-6">
              <UploadForm />
            </div>
          ) : null}

          <form className="mb-5 flex flex-wrap items-end gap-3" role="search">
            {showArchived ? <input type="hidden" name="show" value="archived" /> : null}
            <SearchField
              id="media-search"
              name="q"
              label="Find a photo"
              placeholder="Name or description"
              initial={params.q ?? ''}
              basePath="/admin/media"
              keep={{ tag: params.tag, show: showArchived ? 'archived' : undefined }}
              submitLabel="Filter"
            />
            <div>
              <label htmlFor="media-tag" className="block text-[0.8125rem] font-semibold text-brown">
                Tag
              </label>
              <select
                id="media-tag"
                name="tag"
                defaultValue={params.tag ?? ''}
                className="mt-1.5 min-h-11 rounded-full border border-brown/25 bg-linen px-3 text-[0.9375rem] text-brown transition-colors hover:border-brown/40"
              >
                <option value="">All</option>
                {MEDIA_TAGS.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-full border border-brown/25 px-4 text-[0.9375rem] font-semibold text-brown transition-colors hover:border-brown/45 hover:bg-brown/6"
            >
              Apply tag
            </button>
            <Link
              href={showArchived ? '/admin/media' : '/admin/media?show=archived'}
              className="inline-flex min-h-11 items-center text-[0.875rem] text-clay underline underline-offset-4 hover:text-coral-deep"
            >
              {showArchived ? 'Back to the library' : 'Show archived'}
            </Link>
          </form>

          {visible.length === 0 ? (
            <EmptyState>Nothing matches. Try a different word.</EmptyState>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((entry) => {
                const problems = mediaProblems(entry);
                return (
                  <li key={entry.assetId}>
                    <Link
                      href={`/admin/media/${entry.assetId}`}
                      className="group flex h-full flex-col overflow-hidden rounded-(--radius-md) border border-brown/20 bg-linen transition-all duration-200 hover:-translate-y-0.5 hover:border-coral hover:shadow-[0_18px_45px_rgba(78,49,20,0.10)]"
                    >
                      <span className="relative block aspect-4/3 w-full bg-ivory-deep">
                        {entry.path && entry.kind === 'video' ? (
                          <video
                            src={entry.path}
                            poster={entry.poster ?? undefined}
                            muted
                            playsInline
                            preload="metadata"
                            className="size-full object-cover"
                          />
                        ) : entry.path ? (
                          <Image
                            src={entry.path}
                            alt=""
                            fill
                            sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 90vw"
                            className="object-cover"
                          />
                        ) : (
                          <span className="flex size-full items-center justify-center text-[0.8125rem] text-brown-soft">
                            No file yet
                          </span>
                        )}
                      </span>
                      <span className="flex flex-1 flex-col p-3">
                        <span className="text-[0.9375rem] font-semibold text-brown group-hover:text-clay">
                          {entry.title}
                          {entry.kind === 'video' ? (
                            <span className="ml-2 rounded-full bg-teal/8 px-2 py-0.5 text-[0.6875rem] uppercase tracking-wide text-teal">
                              Video
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 text-[0.8125rem] text-brown-soft">
                          {entry.decorative
                            ? 'Decorative'
                            : (entry.alt ?? 'No description').slice(0, 60)}
                        </span>
                        <span className="mt-2 text-[0.75rem] text-brown-soft">
                          {totalPlacements(entry) === 0
                            ? 'Not used anywhere'
                            : `Used in ${totalPlacements(entry)} ${totalPlacements(entry) === 1 ? 'place' : 'places'}`}
                        </span>
                        {problems.length > 0 ? (
                          <span className="mt-2 text-[0.75rem] font-semibold text-danger">
                            {problems[0]}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

        </>
      )}
    </AdminShell>
  );
}
