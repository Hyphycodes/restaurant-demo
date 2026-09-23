import type { ReactNode } from 'react';
import type { PlatformSnapshot } from './snapshot';

/**
 * The operating room, drawn small.
 *
 * These are illustrations of the real admin and staff screens — the same
 * modules, the same vocabulary, the same data where it is cheap to be real —
 * composed for the portfolio sequence. Each one links to the working screen.
 */

function Panel({
  area,
  label,
  meta,
  children,
  href,
}: {
  area: string;
  label: string;
  meta?: string;
  children: ReactNode;
  href?: string;
}) {
  return (
    <article className="cn-ui" style={{ gridArea: area }} data-panel={area}>
      <header className="cn-ui-head">
        <span className="cn-ui-label">{label}</span>
        {meta ? <span className="cn-ui-meta">{meta}</span> : null}
      </header>
      <div className="cn-ui-body">{children}</div>
      {href ? (
        <a className="cn-ui-open" href={href} tabIndex={-1} aria-hidden="true">
          Open ↗
        </a>
      ) : null}
    </article>
  );
}

export function TonightPanel({ snapshot }: { snapshot: PlatformSnapshot }) {
  const event = snapshot.event;
  const pct = event ? Math.round((event.sold / event.capacity) * 100) : 0;
  return (
    <Panel area="tonight" label="Tonight" meta="Admin · Home" href="/demo/admin">
      <p className="cn-ui-greet">Good evening, Alessandro.</p>
      <p className="cn-ui-sub">Doors at 4pm · 11 on the floor · 2 enquiries waiting</p>
      {event ? (
        <div className="cn-ui-feature">
          <span className="cn-ui-kicker">Up next · {event.when}</span>
          <strong>{event.title}</strong>
          <span className="cn-ui-bar">
            <i style={{ width: `${pct}%` }} />
          </span>
          <span className="cn-ui-sub cn-num">
            {event.sold} of {event.capacity} tickets · ${(event.sold * 28).toLocaleString('en-US')} collected
          </span>
        </div>
      ) : null}
      <ul className="cn-ui-stats cn-num">
        <li>
          <b>148</b>covers booked
        </li>
        <li>
          <b>9/10</b>shifts filled
        </li>
        <li>
          <b>2</b>new enquiries
        </li>
      </ul>
    </Panel>
  );
}

export function EventsPanel({ snapshot }: { snapshot: PlatformSnapshot }) {
  return (
    <Panel area="events" label="Events & tickets" meta="Publish · Sell · Scan" href="/admin/events">
      <ul className="cn-ui-rows">
        {snapshot.upcoming.slice(0, 3).map((event) => (
          <li key={event.title + event.when}>
            <span className="cn-num cn-ui-date">{event.when}</span>
            <span className="cn-ui-grow">{event.title}</span>
            <span className="cn-ui-pill" data-tone={event.status === 'Sold out' ? 'wine' : 'live'}>
              {event.status}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function StudioPanel() {
  return (
    <Panel area="studio" label="Content studio" meta="Website · Media · Menu" href="/admin/website">
      <div className="cn-ui-studio">
        <div className="cn-ui-thumb" aria-hidden="true">
          <span>Stay for dinner.</span>
          <em>Leave much later.</em>
        </div>
        <ul className="cn-ui-rows cn-ui-rows-tight">
          <li>
            <span className="cn-ui-grow">Homepage hero</span>
            <span className="cn-ui-pill" data-tone="live">
              Live
            </span>
          </li>
          <li>
            <span className="cn-ui-grow">Autumn menu</span>
            <span className="cn-ui-pill">Draft</span>
          </li>
          <li>
            <span className="cn-ui-grow">Hours · Thanksgiving</span>
            <span className="cn-ui-pill">Scheduled</span>
          </li>
        </ul>
      </div>
    </Panel>
  );
}

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ROTA: { name: string; shifts: (string | null)[] }[] = [
  { name: 'Nico', shifts: ['mgr', null, null, 'mgr', 'mgr', 'mgr', null] },
  { name: 'Marco', shifts: [null, 'bar', null, 'bar', 'bar', 'bar', 'srv'] },
  { name: 'Sofia', shifts: [null, 'srv', null, null, 'srv', 'bar', 'srv'] },
  { name: 'Mia', shifts: [null, null, null, null, null, 'host', null] },
  { name: 'Luca', shifts: [null, null, null, null, 'ktn', 'ktn', null] },
  { name: 'Open', shifts: [null, null, null, null, null, 'srv', null] },
];

export function SchedulePanel() {
  return (
    <Panel area="sched" label="Schedule" meta="Week of Sep 21 · Published" href="/demo/manager">
      <div className="cn-ui-rota" role="presentation">
        <span />
        {WEEK.map((day) => (
          <span key={day} className="cn-ui-rota-day">
            {day}
          </span>
        ))}
        {ROTA.map((row) => (
          <div key={row.name} className="contents">
            <span className="cn-ui-rota-name" data-open={row.name === 'Open'}>
              {row.name}
            </span>
            {row.shifts.map((shift, index) => (
              <span key={index} className="cn-ui-rota-cell" data-kind={shift ?? 'none'} data-open={row.name === 'Open' && Boolean(shift)}>
                {shift ?? ''}
              </span>
            ))}
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function PhonePanel() {
  return (
    <Panel area="phone" label="Staff app" meta="Marco · Bartender" href="/demo/staff">
      <div className="cn-ui-phone">
        <div className="cn-ui-phone-screen">
          <p className="cn-ui-kicker">Today</p>
          <p className="cn-ui-phone-title">5 PM – Close</p>
          <p className="cn-ui-sub">Bartender · Listening Room</p>
          <div className="cn-ui-phone-card" data-tone="wine">
            <span className="cn-ui-kicker">Important</span>
            New closing procedure — tap to acknowledge
          </div>
          <div className="cn-ui-phone-card">
            <span className="cn-ui-kicker">Opening checklist</span>
            <span className="cn-ui-bar">
              <i style={{ width: '60%' }} />
            </span>
            3 of 5 done
          </div>
          <div className="cn-ui-phone-card">
            <span className="cn-ui-kicker">Up for grabs</span>
            Sat · Server · 5 PM – Close
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function ChecklistPanel() {
  const items: [string, boolean, string?][] = [
    ['Candles lit, every table', true, '4:41 PM · Sofia'],
    ['Bar mise en place', true, '4:52 PM · Marco'],
    ['Walk-in temp logged', true, '4:55 PM · Luca'],
    ['Records cued for 9:30', false],
    ['Patio photo', false, 'Photo required'],
  ];
  return (
    <Panel area="check" label="Opening checklist" meta="3 of 5" href="/staff/checklists/demo-opening">
      <ul className="cn-ui-checks">
        {items.map(([label, done, note]) => (
          <li key={label} data-done={done}>
            <i aria-hidden="true">{done ? '✓' : ''}</i>
            <span className="cn-ui-grow">{label}</span>
            {note ? <small>{note}</small> : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function TrainingPanel() {
  return (
    <Panel area="train" label="Training" meta="Due this week" href="/staff/training">
      <ul className="cn-ui-rows cn-ui-rows-tight">
        <li>
          <span className="cn-ui-grow">Alcohol service</span>
          <span className="cn-ui-pill" data-tone="live">
            4 / 5
          </span>
        </li>
        <li>
          <span className="cn-ui-grow">Guest experience</span>
          <span className="cn-ui-pill">5 / 5</span>
        </li>
        <li>
          <span className="cn-ui-grow">Event setup</span>
          <span className="cn-ui-pill">New</span>
        </li>
      </ul>
    </Panel>
  );
}

export function InquiriesPanel({ snapshot }: { snapshot: PlatformSnapshot }) {
  const stages = ['New', 'Contacted', 'Planning', 'Booked'];
  const rows =
    snapshot.inquiries.length > 0
      ? snapshot.inquiries
      : [
          { name: 'Jamie Morgan', kind: 'Rehearsal dinner', guests: 24, status: 'New' },
          { name: 'Avery Brooks', kind: 'Catering', guests: 20, status: 'New' },
        ];
  return (
    <Panel area="inq" label="Private events" meta="Pipeline" href="/admin/inquiries">
      <div className="cn-ui-pipeline">
        {stages.map((stage) => {
          const inStage = rows.filter((row) => row.status === stage);
          return (
            <div key={stage}>
              <span className="cn-ui-kicker">
                {stage} <b className="cn-num">{inStage.length}</b>
              </span>
              {inStage.slice(0, 2).map((row) => (
                <span key={row.name} className="cn-ui-deal">
                  {row.name.split(' ')[0]}
                  <small>
                    {row.kind}
                    {row.guests ? ` · ${row.guests}` : ''}
                  </small>
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export function OperatingRoom({ snapshot }: { snapshot: PlatformSnapshot }) {
  return (
    <div className="cn-os-grid">
      <TonightPanel snapshot={snapshot} />
      <EventsPanel snapshot={snapshot} />
      <StudioPanel />
      <SchedulePanel />
      <PhonePanel />
      <ChecklistPanel />
      <TrainingPanel />
      <InquiriesPanel snapshot={snapshot} />
    </div>
  );
}
