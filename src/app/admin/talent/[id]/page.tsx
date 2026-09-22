import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AdminShell, NoAccess } from '@/components/admin/AdminShell';
import { Card, HelpNote } from '@/components/admin/ui';
import { describeLink, TALENT_DISCIPLINE_LABEL } from '@/content/talent';
import { getReadDb, isLocalDb } from '@/lib/db';
import { getStaff, staffCan } from '@/server/auth';
import { getTalent } from '@/server/content/talent';
import { TalentControls } from './TalentControls';

export const dynamic = 'force-dynamic';


export default async function TalentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');
  const local = isLocalDb();

  if (!staffCan(staff, 'inquiries.manage')) {
    return (
      <AdminShell staff={staff} local={local} title="Talent" backTo={{ href: '/admin/talent', label: 'Talent' }}>
        <NoAccess what="talent submissions" />
      </AdminShell>
    );
  }

  const { id } = await params;
  const db = getReadDb();
  const person = db ? await getTalent(db, id) : null;
  if (!person) notFound();

  const links = person.links.map(describeLink);
  const sent = person.createdAt
    ? new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(Date.parse(person.createdAt))
    : 'unknown';

  return (
    <AdminShell
      staff={staff}
      local={local}
      title={person.name}
      description={TALENT_DISCIPLINE_LABEL[person.discipline]}
      backTo={{ href: '/admin/talent', label: 'Talent' }}
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="grid grid-cols-1 gap-5 lg:col-span-7">
          <Card title="What they do">
            <p className="whitespace-pre-line text-[1rem] leading-relaxed text-brown">
              {person.pitch}
            </p>

            {person.idea ? (
              <div className="mt-5 border-t border-brown/12 pt-4">
                <p className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-brown-soft">
                  What they want to do here
                </p>
                <p className="mt-1.5 whitespace-pre-line text-[0.9375rem] leading-relaxed text-brown">
                  {person.idea}
                </p>
              </div>
            ) : null}

            {person.notes ? (
              <div className="mt-5 border-t border-brown/12 pt-4">
                <p className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-brown-soft">
                  They also said
                </p>
                <p className="mt-1.5 whitespace-pre-line text-[0.9375rem] leading-relaxed text-brown">
                  {person.notes}
                </p>
              </div>
            ) : null}
          </Card>

          {links.length > 0 ? (
            <Card title="Their work">
              <ul className="grid gap-2">
                {links.map((link) => (
                  <li key={link.url}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="flex min-h-11 items-center gap-3 rounded-(--radius-sm) border border-brown/15 px-3 py-2 text-[0.9375rem] text-brown transition-colors hover:border-clay hover:bg-brown/4"
                    >
                      <span className="shrink-0 rounded-full bg-brown/8 px-2.5 py-1 text-[0.75rem] font-semibold text-brown-soft">
                        {link.host}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{link.label}</span>
                      <span aria-hidden="true" className="text-brown-soft">
                        ↗
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {person.mediaPaths.length > 0 ? (
            <Card title="What they sent">
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {person.mediaPaths.map((path) => (
                  <li key={path}>
                    <a href={`/admin/files/${path}`} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element --
                          a private file served through our own gate; next/image
                          cannot fetch it. */}
                      <img
                        src={`/admin/files/${path}`}
                        alt=""
                        loading="lazy"
                        className="aspect-square w-full rounded-(--radius-sm) bg-brown/8 object-cover transition-opacity hover:opacity-90"
                      />
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:col-span-5">
          <Card title="Reach them">
            <dl className="grid gap-3 text-[0.9375rem]">
              {person.phone ? (
                <div>
                  <dt className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-brown-soft">
                    Phone
                  </dt>
                  <dd className="mt-1">
                    <a
                      href={`tel:+1${person.phone.replace(/\D/g, '')}`}
                      className="tabular font-semibold text-brown underline underline-offset-4"
                    >
                      {person.phone}
                    </a>
                  </dd>
                </div>
              ) : null}
              {person.email ? (
                <div>
                  <dt className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-brown-soft">
                    Email
                  </dt>
                  <dd className="mt-1 min-w-0">
                    <a
                      href={`mailto:${person.email}`}
                      className="block truncate font-semibold text-brown underline underline-offset-4"
                    >
                      {person.email}
                    </a>
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-brown-soft">
                  Sent
                </dt>
                <dd className="mt-1 text-brown">{sent}</dd>
              </div>
              <div>
                <dt className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-brown-soft">
                  Reference
                </dt>
                <dd className="tabular mt-1 text-brown-soft">{person.reference}</dd>
              </div>
            </dl>
          </Card>

          <Card title="Where this is at">
            <TalentControls person={person} canBook={staffCan(staff, 'content.publish')} />
          </Card>

          {person.contractorId ? (
            <HelpNote>
              They are on the contractor roster.{' '}
              <Link
                href={`/staff/contractors/${person.contractorId}`}
                className="font-semibold text-brown underline underline-offset-4"
              >
                Open their roster page
              </Link>{' '}
              to book them, set a rate and chase the W-9.
            </HelpNote>
          ) : null}
        </div>
      </div>
    </AdminShell>
  );
}
