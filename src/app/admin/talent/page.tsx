import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminShell, NoAccess } from '@/components/admin/AdminShell';
import { SearchField } from '@/components/admin/SearchField';
import { Card, EmptyState, Tabs } from '@/components/admin/ui';
import {
  describeLink,
  TALENT_DISCIPLINES,
  TALENT_DISCIPLINE_LABEL,
  TALENT_STATUS_LABEL,
  type TalentSubmission,
} from '@/content/talent';
import { getReadDb, isLocalDb } from '@/lib/db';
import { getStaff, staffCan } from '@/server/auth';
import { listTalent } from '@/server/content/talent';

export const dynamic = 'force-dynamic';

/**
 * The talent book.
 *
 * Cards, not rows. Everybody in here is a person whose work is the point, so
 * the thing you are scanning for is "who is this and what do they do" —
 * which is a photograph, a sentence and a discipline, not a table.
 *
 * Filters that earn their place: where somebody is up to, and what they do.
 * There is no date range, no owner, no source and no score.
 */
export default async function TalentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; kind?: string; q?: string }>;
}) {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');
  const local = isLocalDb();

  if (!staffCan(staff, 'inquiries.manage')) {
    return (
      <AdminShell staff={staff} local={local} title="Talent">
        <NoAccess what="talent submissions" />
      </AdminShell>
    );
  }

  const params = await searchParams;
  const status = params.status ?? 'open';
  const db = getReadDb();

  const [people, all] = await Promise.all([
    db ? listTalent(db, { status, discipline: params.kind, query: params.q }) : [],
    db ? listTalent(db) : [],
  ]);

  const count = (value: string) =>
    value === 'open'
      ? all.filter((entry) => entry.status !== 'archived').length
      : all.filter((entry) => entry.status === value).length;

  // Only disciplines somebody has actually used: a filter for a category with
  // nothing in it is a dead control.
  const present = TALENT_DISCIPLINES.filter((entry) =>
    all.some((person) => person.discipline === entry.id),
  );

  return (
    <AdminShell
      staff={staff}
      local={local}
      title="Talent"
      description="Everybody who has shown Casa Aurelia what they do."
    >
      {!db ? (
        <EmptyState>
          Talent submissions are not connected yet, so the form on the website asks people to call
          instead of claiming their work was saved.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          <Card>
            <Tabs
              label="Filter talent"
              items={[
                { id: 'open', label: 'Everyone' },
                { id: 'new', label: TALENT_STATUS_LABEL.new },
                { id: 'interested', label: TALENT_STATUS_LABEL.interested },
                { id: 'booked', label: TALENT_STATUS_LABEL.booked },
                { id: 'featured', label: TALENT_STATUS_LABEL.featured },
                { id: 'archived', label: TALENT_STATUS_LABEL.archived },
              ].map((tab) => ({
                href: query({ status: tab.id, kind: params.kind, q: params.q }),
                label: tab.label,
                active: status === tab.id,
                count: count(tab.id),
              }))}
            />

            <div className="mt-4 flex flex-wrap items-end gap-4">
              <SearchField
                id="talent-search"
                name="q"
                label="Find somebody"
                placeholder="Name, what they do, a link"
                initial={params.q ?? ''}
                basePath="/admin/talent"
                keep={{ status: params.status, kind: params.kind }}
              />
              {present.length > 1 ? (
                <div className="min-w-48 flex-1">
                  <p className="text-[0.8125rem] font-semibold text-brown">What they do</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <Chip
                      href={query({ status: params.status, q: params.q })}
                      label="Everything"
                      active={!params.kind}
                    />
                    {present.map((entry) => (
                      <Chip
                        key={entry.id}
                        href={query({ status: params.status, q: params.q, kind: entry.id })}
                        label={entry.label}
                        active={params.kind === entry.id}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          {people.length === 0 ? (
            <EmptyState>
              {all.length === 0
                ? 'Nobody has sent anything yet. The form is live at /talent — share it on Instagram and this fills itself.'
                : 'Nobody here matches that.'}
            </EmptyState>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {people.map((person) => (
                <li key={person.id}>
                  <TalentCard person={person} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </AdminShell>
  );
}

function query(values: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
  }
  const search = params.toString();
  return search ? `/admin/talent?${search}` : '/admin/talent';
}

function Chip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <a
      href={href}
      aria-current={active ? 'true' : undefined}
      className={`inline-flex min-h-9 items-center rounded-full px-3 text-[0.8125rem] font-semibold transition-colors ${
        active ? 'bg-brown text-linen' : 'border border-brown/25 text-brown-soft hover:text-brown'
      }`}
    >
      {label}
    </a>
  );
}

const STATUS_TONE: Record<string, string> = {
  new: 'border-warning/60 bg-warning/8 text-warning',
  interested: 'border-clay/45 bg-clay/8 text-clay',
  contacted: 'border-brown/30 bg-brown/6 text-brown',
  booked: 'border-success/50 bg-success/10 text-success',
  featured: 'border-amber/60 bg-amber/12 text-brown',
  archived: 'border-brown/25 text-brown-soft',
};

function TalentCard({ person }: { person: TalentSubmission }) {
  const links = person.links.slice(0, 3).map(describeLink);

  return (
    <Link
      href={`/admin/talent/${person.id}`}
      className="admin-raised group flex h-full flex-col overflow-hidden rounded-(--radius-md) border border-brown/12 bg-linen transition-colors hover:border-clay"
    >
      {person.mediaPaths[0] ? (
        /* A private file served through our own gate, with a signed URL that
           expires in five minutes. next/image cannot fetch it, and it must
           never be cached on a CDN. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/admin/files/${person.mediaPaths[0]}`}
          alt=""
          loading="lazy"
          className="aspect-3/2 w-full bg-brown/8 object-cover"
        />
      ) : null}

      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-[1.0625rem] font-semibold text-brown group-hover:text-clay">
            {person.name}
          </p>
          <span
            className={`shrink-0 rounded-(--radius-sm) border px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] ${
              STATUS_TONE[person.status] ?? STATUS_TONE.contacted
            }`}
          >
            {TALENT_STATUS_LABEL[person.status]}
          </span>
        </div>

        <p className="mt-0.5 text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-clay">
          {TALENT_DISCIPLINE_LABEL[person.discipline]}
        </p>

        <p className="mt-2 line-clamp-3 text-[0.9375rem] leading-relaxed text-brown-soft">
          {person.pitch}
        </p>

        {links.length > 0 ? (
          <p className="mt-3 flex flex-wrap gap-1.5">
            {links.map((link) => (
              <span
                key={link.url}
                className="rounded-full bg-brown/8 px-2.5 py-1 text-[0.75rem] font-medium text-brown-soft"
              >
                {link.host}
              </span>
            ))}
            {person.links.length > 3 ? (
              <span className="px-1 py-1 text-[0.75rem] text-brown-soft">
                +{person.links.length - 3}
              </span>
            ) : null}
          </p>
        ) : null}

        <p className="tabular mt-auto pt-3 text-[0.75rem] text-brown-soft">
          {person.createdAt
            ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
                Date.parse(person.createdAt),
              )
            : ''}
          {person.contractorId ? ' · on the roster' : ''}
        </p>
      </div>
    </Link>
  );
}
