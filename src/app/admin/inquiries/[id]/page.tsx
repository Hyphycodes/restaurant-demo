import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminShell, NoAccess } from '@/components/admin/AdminShell';
import { Card, HelpNote } from '@/components/admin/ui';
import type { InquiryRecord } from '@/content/types';
import { getReadDb, isLocalDb } from '@/lib/db';
import {
  daysBetween,
  formatDay,
  formatMoment,
  guestCount,
  INQUIRY_STAGE_LABEL,
  INQUIRY_TYPE_LABEL,
  isFollowUpOverdue,
  messageOf,
  relativeAge,
  requestedDate,
  venueToday,
} from '@/lib/inquiry-pipeline';
import { getStaff, staffCan } from '@/server/auth';
import { getInquiry } from '@/server/content/inquiries';
import { PlanForm, StageStepper } from './InquiryControls';

export const dynamic = 'force-dynamic';

/**
 * One enquiry: who, what they asked for, where it has got to, and what happens
 * next. Everything on one screen, no tabs. On a phone it is a single column:
 * the stage first, then the request and its timeline, then contact and plan.
 */

const LABEL = 'text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-brown-soft';

const CONTACT_PREFERENCE: Record<string, string> = {
  phone: 'Phone call',
  text: 'Text message',
  email: 'Email',
};

const FULFILLMENT: Record<string, string> = {
  pickup: 'Pickup',
  delivery: 'Delivery, if possible',
  'not-sure': 'Not sure yet',
};

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export default async function InquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');
  const local = isLocalDb();
  const backTo = { href: '/admin/inquiries', label: 'Enquiries' };

  if (!staffCan(staff, 'inquiries.manage')) {
    return (
      <AdminShell staff={staff} local={local} title="Enquiry" backTo={backTo}>
        <NoAccess what="enquiries" />
      </AdminShell>
    );
  }

  const { id } = await params;
  const db = getReadDb();
  const inquiry = db ? await getInquiry(db, id) : null;
  if (!inquiry) notFound();

  const now = new Date();
  const today = venueToday(now);
  const typeLabel = INQUIRY_TYPE_LABEL[inquiry.type];

  return (
    <AdminShell
      staff={staff}
      local={local}
      title={inquiry.name}
      description={`${typeLabel} · received ${relativeAge(inquiry.createdAt, now)}${
        inquiry.reference ? ` · ${inquiry.reference}` : ''
      }`}
      backTo={backTo}
    >
      <div className="grid grid-cols-1 gap-5">
        <Card title="Stage">
          <StageStepper id={inquiry.id} status={inquiry.status} />
        </Card>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="grid min-w-0 grid-cols-1 content-start gap-5 lg:col-span-7">
            <Card title="The request">
              <RequestDetails inquiry={inquiry} today={today} />
            </Card>

            <Card title="Timeline">
              <Timeline inquiry={inquiry} today={today} />
            </Card>
          </div>

          <div className="grid min-w-0 grid-cols-1 content-start gap-5 lg:col-span-5">
            <Card title="Reach them">
              <Contact inquiry={inquiry} />
            </Card>

            <Card title="The plan">
              <PlanForm
                id={inquiry.id}
                nextStep={inquiry.nextStep}
                followUpOn={inquiry.followUpOn}
                notes={inquiry.notes}
                today={today}
              />
            </Card>

            <HelpNote>
              Nothing here is sent to the guest. Enquiries are never deleted — move one to Closed and
              note why.
            </HelpNote>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function Contact({ inquiry }: { inquiry: InquiryRecord }) {
  const preference = str(inquiry.payload.contactPreference);
  return (
    <dl className="grid gap-3 text-[0.9375rem]">
      {inquiry.phone ? (
        <div>
          <dt className={LABEL}>Phone</dt>
          <dd className="mt-1">
            <a
              href={`tel:+1${inquiry.phone.replace(/\D/g, '')}`}
              className="tabular inline-flex min-h-11 items-center font-semibold text-brown underline underline-offset-4"
            >
              {inquiry.phone}
            </a>
          </dd>
        </div>
      ) : null}
      <div className="min-w-0">
        <dt className={LABEL}>Email</dt>
        <dd className="mt-1 min-w-0">
          <a
            href={`mailto:${inquiry.email}?subject=${encodeURIComponent(
              `Your ${inquiry.type === 'catering' ? 'catering' : 'private event'} enquiry${
                inquiry.reference ? ` (${inquiry.reference})` : ''
              }`,
            )}`}
            className="inline-flex min-h-11 max-w-full items-center break-all font-semibold text-brown underline underline-offset-4"
          >
            {inquiry.email}
          </a>
        </dd>
      </div>
      {preference ? (
        <div>
          <dt className={LABEL}>Prefers</dt>
          <dd className="mt-1 text-brown">{CONTACT_PREFERENCE[preference] ?? preference}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function RequestDetails({ inquiry, today }: { inquiry: InquiryRecord; today: string }) {
  const { payload } = inquiry;
  const date = requestedDate(inquiry);
  const guests = guestCount(inquiry);
  const message = messageOf(inquiry);
  const until = date ? daysBetween(today, date) : null;

  const rows: { label: string; value: ReactNode }[] = [];
  if (inquiry.type === 'private-event') {
    rows.push({ label: 'Occasion', value: str(payload.eventType) ?? 'Not given' });
  } else if (inquiry.type === 'catering') {
    const organization = str(payload.organization);
    if (organization) rows.push({ label: 'Organization', value: organization });
  }
  rows.push({
    label: 'Date',
    value: date ? (
      <>
        {formatDay(date, today, 'long')}
        {until !== null ? (
          <span className="ml-1.5 text-brown-soft">
            ({until === 0 ? 'today' : until === 1 ? 'tomorrow' : until > 0 ? `in ${until} days` : `${-until} days ago`})
          </span>
        ) : null}
      </>
    ) : (
      'Not given'
    ),
  });
  if (inquiry.type === 'private-event') {
    rows.push({ label: 'Flexibility', value: payload.dateFlexible === true ? 'Their date is flexible' : 'That date specifically' });
  }
  const time = str(payload.time);
  if (time) rows.push({ label: 'Time', value: time });
  rows.push({ label: 'Guests', value: guests ? String(guests) : 'Not given' });
  if (inquiry.type === 'catering') {
    rows.push({ label: 'Package', value: str(payload.packageInterest) ?? 'Not chosen' });
    const fulfillment = str(payload.fulfillment);
    rows.push({ label: 'Fulfilment', value: fulfillment ? (FULFILLMENT[fulfillment] ?? fulfillment) : 'Not given' });
  }

  // Anything a form sent that is not shown above (an older form, a careers
  // application) still appears, so no business detail is hidden.
  const shown = new Set(['eventType', 'organization', 'date', 'dateFlexible', 'time', 'guests', 'packageInterest', 'fulfillment', 'contactPreference', 'notes', 'message']);
  for (const [key, value] of Object.entries(payload)) {
    if (shown.has(key) || value === null || value === '') continue;
    rows.push({ label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()), value: String(value) });
  }

  return (
    <>
      <dl className="grid gap-x-6 gap-y-3 text-[0.9375rem] sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0">
            <dt className={LABEL}>{row.label}</dt>
            <dd className="mt-1 break-words text-brown">{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 border-t border-brown/12 pt-4">
        <p className={LABEL}>In their words</p>
        {message ? (
          <blockquote className="mt-1.5 whitespace-pre-line break-words border-l-2 border-coral/60 pl-3 text-[1rem] leading-relaxed text-brown">
            {message}
          </blockquote>
        ) : (
          <p className="mt-1.5 text-[0.9375rem] text-brown-soft">They did not add a message.</p>
        )}
      </div>
    </>
  );
}

interface Moment {
  key: string;
  /** Sortable: an ISO instant, or a YYYY-MM-DD day (sorted as that day's noon). */
  at: string;
  title: string;
  detail: string;
  tone: 'past' | 'future' | 'warning';
}

function Timeline({ inquiry, today }: { inquiry: InquiryRecord; today: string }) {
  const moments: Moment[] = [
    {
      key: 'received',
      at: inquiry.createdAt,
      title: 'Enquiry received',
      detail: `${formatMoment(inquiry.createdAt)} · through the website`,
      tone: 'past',
    },
  ];

  const moved = inquiry.status !== 'new' && inquiry.statusChangedAt && inquiry.statusChangedAt !== inquiry.createdAt;
  if (moved) {
    moments.push({
      key: 'status',
      at: inquiry.statusChangedAt,
      title: `Moved to ${INQUIRY_STAGE_LABEL[inquiry.status]}`,
      detail: formatMoment(inquiry.statusChangedAt),
      tone: 'past',
    });
  }

  if (inquiry.followUpOn && inquiry.status !== 'closed') {
    const overdue = isFollowUpOverdue(inquiry, today);
    moments.push({
      key: 'follow-up',
      at: `${inquiry.followUpOn}T12:00:00Z`,
      title: overdue ? 'Follow-up overdue' : inquiry.followUpOn === today ? 'Follow up today' : 'Follow up',
      detail: `${formatDay(inquiry.followUpOn, today, 'long')}${inquiry.nextStep ? ` · ${inquiry.nextStep}` : ''}`,
      tone: overdue ? 'warning' : 'future',
    });
  }

  const date = requestedDate(inquiry);
  if (date) {
    moments.push({
      key: 'event',
      at: `${date}T18:00:00Z`,
      title: inquiry.type === 'catering' ? 'Catering date' : 'The event',
      detail: formatDay(date, today, 'long'),
      tone: date < today ? 'past' : 'future',
    });
  }

  moments.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  return (
    <ol className="grid gap-0">
      {moments.map((moment, index) => (
        <li key={moment.key} className="relative flex gap-3 pb-4 last:pb-0">
          {index < moments.length - 1 ? (
            <span aria-hidden="true" className="absolute left-[5px] top-4 bottom-0 w-px bg-brown/15" />
          ) : null}
          <span
            aria-hidden="true"
            className={`relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 ${
              moment.tone === 'warning'
                ? 'border-warning bg-warning'
                : moment.tone === 'future'
                  ? 'border-brown/40 bg-ivory'
                  : 'border-coral bg-coral'
            }`}
          />
          <div className="min-w-0">
            <p className={`text-[0.9375rem] font-semibold ${moment.tone === 'warning' ? 'text-warning' : 'text-brown'}`}>
              {moment.title}
            </p>
            <p className="mt-0.5 break-words text-[0.8125rem] leading-relaxed text-brown-soft">{moment.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
