import type { Metadata } from 'next';
import Link from 'next/link';
import { MotionScope } from '@/components/cosa/motion/MotionScope';
import { PageHero } from '@/components/cosa/page/PageHero';
import { Behind } from '@/components/cosa/platform/Behind';
import {
  ChecklistPanel,
  EventsPanel,
  InquiriesPanel,
  PhonePanel,
  SchedulePanel,
  StudioPanel,
  TonightPanel,
  TrainingPanel,
} from '@/components/cosa/platform/Panels';
import { getPlatformSnapshot } from '@/components/cosa/platform/snapshot';

export const metadata: Metadata = {
  title: 'Behind the hospitality — Cosa Nostra',
  description: 'The operating system behind a fictional supper club: content studio, events and tickets, scheduling, staff workspace, checklists, training and the private-events pipeline.',
};
export const dynamic = 'force-dynamic';

export default async function BehindPage() {
  const snapshot = await getPlatformSnapshot();
  const modules = [
    {
      key: 'tonight',
      eyebrow: 'For the owner',
      title: 'Tonight, at a glance.',
      body: 'The first screen answers one question: what is happening today? Doors, the night’s event and how full it is, who is on the floor, and the few things that need a decision.',
      points: ['Open or closed, from the hours the site publishes', 'Attendance against capacity', 'Coverage and open shifts', 'Enquiries and applications waiting'],
      href: '/demo/admin',
      cta: 'Open the admin',
      panel: <TonightPanel snapshot={snapshot} />,
    },
    {
      key: 'studio',
      eyebrow: 'Content studio',
      title: 'The website, edited like a notebook.',
      body: 'Menus, prices, hours, page copy and photography are edited in plain language, saved as drafts, previewed and published. Every change reaches every page that uses it.',
      points: ['Draft, preview, publish, roll back', 'A central photo & video library', 'Hero media replaced in one step', 'Contrast-safe look controls'],
      href: '/admin/website',
      cta: 'See the studio',
      panel: <StudioPanel />,
    },
    {
      key: 'events',
      eyebrow: 'Events & tickets',
      title: 'From idea to door list.',
      body: 'Create a night, add the flyer, choose free or ticketed, set capacity and tiers, publish — and scan guests in at the door. In this demo, no card is ever charged.',
      points: ['Recurring series and one-off nights', 'Ticket tiers, capacity, closing sales', 'Duplicate a past night', 'Door list and scanner'],
      href: '/admin/events',
      cta: 'Manage events',
      panel: <EventsPanel snapshot={snapshot} />,
    },
    {
      key: 'inq',
      eyebrow: 'Private events & catering',
      title: 'A pipeline, not an inbox.',
      body: 'Every enquiry from the website lands as New and moves through Contacted, Planning, Booked and Closed, with a next step and a follow-up date so nothing goes quiet.',
      points: ['Five stages, one board', 'Follow-ups that turn amber when overdue', 'Everything the guest sent, in one place'],
      href: '/admin/inquiries',
      cta: 'Open the pipeline',
      panel: <InquiriesPanel snapshot={snapshot} />,
    },
    {
      key: 'sched',
      eyebrow: 'Scheduling',
      title: 'Build the week, then publish it.',
      body: 'Managers draft shifts on a calendar, see coverage and open shifts at a glance, and publish when ready — staff are notified only then.',
      points: ['Drafts stay private until published', 'Open shifts staff can claim', 'Conflicts and coverage flagged'],
      href: '/demo/manager',
      cta: 'Build a schedule',
      panel: <SchedulePanel />,
    },
    {
      key: 'phone',
      eyebrow: 'Staff workspace',
      title: 'Everything a shift needs, nothing it doesn’t.',
      body: 'A phone-first app for the team: today’s shift, the next one, the checklist, the one announcement that matters, and training that is due.',
      points: ['Built for one hand, mid-service', 'Acknowledge what matters', 'Pick up open shifts'],
      href: '/demo/staff',
      cta: 'Work a shift',
      panel: <PhonePanel />,
    },
    {
      key: 'check',
      eyebrow: 'Checklists',
      title: 'Opening, closing, the bar, the patio.',
      body: 'Reusable checklists with required items, optional photo proof, notes and timestamps. Managers see completion; staff see a short list, not a surveillance tool.',
      points: ['Required items and photo proof', 'Assigned by role', 'Completion visible to managers'],
      href: '/demo/staff',
      cta: 'Open a checklist',
      panel: <ChecklistPanel />,
    },
    {
      key: 'train',
      eyebrow: 'Training',
      title: 'Short lessons, actually finished.',
      body: 'Alcohol service, opening procedure, guest experience: text, images and a quick knowledge check, with completion and acknowledgement tracked.',
      points: ['Modules with quick checks', 'Due dates by role', 'Acknowledgement on record'],
      href: '/staff/training',
      cta: 'See training',
      panel: <TrainingPanel />,
    },
  ];

  return (
    <>
      <PageHero
        eyebrow="Behind the hospitality"
        title={
          <>
            One restaurant. <em>One connected system.</em>
          </>
        }
        lede="Cosa Nostra is a fictional supper club and a working restaurant platform: the website guests fall for, the operating room behind it, and the workspace the team carries through a shift."
        compact
        aside={
          <div className="flex flex-wrap gap-3">
            <Link href="/demo" className="cn-btn">
              Explore the demo <span className="cn-arrow" aria-hidden="true">→</span>
            </Link>
          </div>
        }
      />
      <Behind snapshot={snapshot} />
      <section className="cn-night cn-section" aria-label="The modules">
        <div className="cn-wrap">
          {modules.map((module) => (
            <MotionScope key={module.key} as="article" className="cn-module">
              <div>
                <p className="cn-eyebrow" data-m="up">
                  {module.eyebrow}
                </p>
                <h2 className="cn-display cn-md mt-4" data-m="title">
                  {module.title}
                </h2>
                <p className="cn-lede mt-5" data-m="up">
                  {module.body}
                </p>
                <ul className="cn-module-points" data-m="stagger">
                  {module.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                <Link href={module.href} className="cn-link mt-6" data-m="up">
                  {module.cta} →
                </Link>
              </div>
              <div className="cn-module-visual" data-m="up" data-delay="0.2">
                {module.panel}
              </div>
            </MotionScope>
          ))}
        </div>
      </section>
    </>
  );
}
