import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminShell, NoAccess } from '@/components/admin/AdminShell';
import { EmptyState, HelpNote, SummaryStrip, Tabs } from '@/components/admin/ui';
import type { InquiryRecord, InquiryStatus } from '@/content/types';
import { getReadDb, isLocalDb } from '@/lib/db';
import {
  filterInquiries,
  formatDay,
  groupByStage,
  guestCount,
  INQUIRY_FILTERS,
  INQUIRY_STAGES,
  INQUIRY_STAGE_HINT,
  INQUIRY_STAGE_LABEL,
  INQUIRY_TYPE_LABEL,
  isFollowUpOverdue,
  isFollowUpToday,
  occasionOf,
  parseInquiryFilter,
  relativeAge,
  requestedDate,
  summarizePipeline,
  summaryLine,
  venueToday,
} from '@/lib/inquiry-pipeline';
import { getStaff, staffCan } from '@/server/auth';
import { listInquiries } from '@/server/content/inquiries';

export const dynamic = 'force-dynamic';

/**
 * Enquiries — the private-events & catering pipeline.
 *
 * Five stages, left to right, New → Contacted → Planning → Booked → Closed. On
 * a wide screen that is a board; on a phone the same five sections simply
 * stack, so it reads as a list grouped by stage. There is no drag and drop:
 * a card opens the enquiry, and the stage is changed there, where the guest's
 * details are in front of you.
 *
 * Still not a CRM, and still no delete: an enquiry is a business record.
 */

const STAGE_ACCENT: Record<InquiryStatus, string> = {
  new: 'bg-warning',
  contacted: 'bg-brown-soft',
  planning: 'bg-coral',
  booked: 'bg-success',
  closed: 'bg-brown/30',
};

export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');
  const local = isLocalDb();

  if (!staffCan(staff, 'inquiries.manage')) {
    return (
      <AdminShell staff={staff} local={local} title="Enquiries">
        <NoAccess what="enquiries" />
      </AdminShell>
    );
  }

  const params = await searchParams;
  const filter = parseInquiryFilter(params.type);
  const db = getReadDb();
  const all = db ? await listInquiries(db) : [];

  const now = new Date();
  const today = venueToday(now);
  const shown = filterInquiries(all, filter);
  const summary = summarizePipeline(shown, now);
  const groups = groupByStage(shown);

  return (
    <AdminShell
      staff={staff}
      local={local}
      title="Enquiries"
      description="Private events and catering, from the first message to the night itself."
    >
      {!db ? (
        <EmptyState>
          The inbox is not connected. Forms ask guests to call instead of claiming their message was saved.
        </EmptyState>
      ) : all.length === 0 ? (
        <EmptyState>
          No enquiries yet. They arrive here from the private events and catering forms on the website.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          <div className="grid gap-3">
            <SummaryStrip tone={summary.overdue > 0 ? 'warning' : 'info'}>
              <strong className="font-semibold">{summaryLine(summary)}</strong>
            </SummaryStrip>
            <Tabs
              label="Show enquiries"
              items={INQUIRY_FILTERS.map((entry) => ({
                href: entry.id === 'all' ? '/admin/inquiries' : `/admin/inquiries?type=${entry.id}`,
                label: entry.label,
                active: filter === entry.id,
                count: filterInquiries(all, entry.id).filter((inquiry) => inquiry.status !== 'closed').length,
              }))}
            />
          </div>

          {shown.length === 0 ? (
            <EmptyState>Nothing here yet for {INQUIRY_FILTERS.find((entry) => entry.id === filter)?.label.toLowerCase()}.</EmptyState>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-5 lg:gap-3">
              {INQUIRY_STAGES.map((stage) => {
                const cards = groups[stage];
                const headingId = `stage-${stage}`;
                return (
                  <section
                    key={stage}
                    aria-labelledby={headingId}
                    className="min-w-0 rounded-(--radius-md) bg-brown/4 p-2.5 lg:min-h-64"
                  >
                    <header className="flex items-baseline justify-between gap-2 px-1.5 pb-2.5 pt-1">
                      <h2 id={headingId} className="flex min-w-0 items-center gap-2 text-[0.9375rem] font-semibold text-brown">
                        <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${STAGE_ACCENT[stage]}`} />
                        {INQUIRY_STAGE_LABEL[stage]}
                        <span className="tabular inline-flex min-w-5 items-center justify-center rounded-full bg-brown/10 px-1.5 text-[0.75rem] font-semibold text-brown-soft">
                          <span className="sr-only">, </span>
                          {cards.length}
                        </span>
                      </h2>
                    </header>
                    <p className="-mt-1.5 px-1.5 pb-2.5 text-[0.75rem] leading-snug text-brown-soft">
                      {INQUIRY_STAGE_HINT[stage]}
                    </p>
                    {cards.length === 0 ? (
                      <p className="rounded-(--radius-sm) border border-dashed border-brown/20 px-3 py-4 text-center text-[0.8125rem] text-brown-soft">
                        Nothing here.
                      </p>
                    ) : (
                      <ul className="grid gap-2">
                        {cards.map((inquiry) => (
                          <li key={inquiry.id}>
                            <InquiryCard inquiry={inquiry} today={today} now={now} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          )}

          <HelpNote>
            Open a card to see the whole request, move it to the next stage, or note the next step and a
            day to follow up. Enquiries are never deleted — Closed keeps the record.
          </HelpNote>
        </div>
      )}
    </AdminShell>
  );
}

function InquiryCard({ inquiry, today, now }: { inquiry: InquiryRecord; today: string; now: Date }) {
  const date = requestedDate(inquiry);
  const guests = guestCount(inquiry);
  const overdue = isFollowUpOverdue(inquiry, today);
  const dueToday = isFollowUpToday(inquiry, today);
  const occasion = occasionOf(inquiry);
  const typeLabel = INQUIRY_TYPE_LABEL[inquiry.type];

  return (
    <Link
      href={`/admin/inquiries/${encodeURIComponent(inquiry.id)}`}
      className={`admin-raised group block rounded-(--radius-sm) border bg-linen p-3 transition-colors duration-150 hover:border-clay ${
        overdue ? 'border-warning/60' : 'border-brown/12'
      }`}
    >
      <span className="block break-words text-[0.9375rem] font-semibold leading-snug text-brown group-hover:text-clay">
        {inquiry.name}
      </span>
      <span className="mt-0.5 block text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-brown-soft">
        {typeLabel}
      </span>
      {occasion !== typeLabel ? (
        <span className="mt-1 block break-words text-[0.8125rem] leading-snug text-brown">{occasion}</span>
      ) : null}

      <span className="tabular mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[0.8125rem] text-brown">
        {date ? <span>{formatDay(date, today)}</span> : <span className="text-brown-soft">No date yet</span>}
        {guests ? (
          <span>
            <span aria-hidden="true" className="text-brown-soft">· </span>
            {guests} {guests === 1 ? 'guest' : 'guests'}
          </span>
        ) : null}
      </span>

      {inquiry.nextStep && inquiry.status !== 'closed' ? (
        <span className="mt-2 text-[0.8125rem] leading-snug text-brown-soft line-clamp-2">
          <span className="sr-only">Next step: </span>→ {inquiry.nextStep}
        </span>
      ) : null}

      <span className="mt-2.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-t border-brown/10 pt-2">
        <span className="text-[0.75rem] text-brown-soft">
          <span className="sr-only">Received </span>
          {relativeAge(inquiry.createdAt, now)}
        </span>
        {inquiry.followUpOn && inquiry.status !== 'closed' ? (
          <span
            className={`tabular inline-flex items-center rounded-(--radius-sm) border px-1.5 py-0.5 text-[0.6875rem] font-semibold ${
              overdue
                ? 'border-warning/60 bg-warning/10 text-warning'
                : dueToday
                  ? 'border-coral/50 bg-coral/10 text-brown'
                  : 'border-brown/20 text-brown-soft'
            }`}
          >
            {overdue ? 'Overdue · ' : dueToday ? '' : 'Follow up '}
            {dueToday ? 'Follow up today' : formatDay(inquiry.followUpOn, today)}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
