'use client';

import { useMemo, useState } from 'react';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { Label, Select, TextArea, TextInput } from '@/components/admin/ui';
import type { TemplateInfo } from '@/emails/registry';
import { sendEventUpdate, sendTestEmail } from '@/server/actions/communications';

/**
 * Preview and test, side by side.
 *
 * Pick an email, a variant where one exists, and a real event; the frame
 * on the right is the actual rendered email. The same three choices feed
 * "Send a test", so what was previewed is what arrives.
 */

export interface EventOption {
  id: string;
  title: string;
  startsAt: string;
  published: boolean;
  ticketing: boolean;
}

function eventLabel(event: EventOption): string {
  const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Chicago' }).format(new Date(event.startsAt));
  return `${date} · ${event.title}${event.published ? '' : ' (draft)'}${event.ticketing ? '' : ' (no tickets)'}`;
}

export function PreviewAndTest({
  templates,
  events,
  defaultTicketDirection,
  canSend,
  staffEmail,
}: {
  templates: TemplateInfo[];
  events: EventOption[];
  defaultTicketDirection: string;
  canSend: boolean;
  staffEmail: string;
}) {
  const [templateId, setTemplateId] = useState<string>(templates[0]?.id ?? 'ticket_confirmation');
  const [variant, setVariant] = useState<string>(defaultTicketDirection);
  const [eventId, setEventId] = useState<string>(events[0]?.id ?? '');
  const [width, setWidth] = useState<'phone' | 'desktop'>('phone');
  const [nonce, setNonce] = useState(0);

  const template = useMemo(() => templates.find((entry) => entry.id === templateId) ?? templates[0]!, [templates, templateId]);
  const variants = template.variants ?? [];
  const activeVariant = variants.some((entry) => entry.id === variant) ? variant : (variants[0]?.id ?? '');
  const src = `/admin/emails/preview?template=${encodeURIComponent(template.id)}&variant=${encodeURIComponent(activeVariant)}&event=${encodeURIComponent(template.needsEvent ? eventId : '')}&n=${nonce}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="grid gap-5">
        <div className="grid gap-4">
          <div>
            <Label htmlFor="comm-template">Email</Label>
            <Select id="comm-template" value={templateId} onChange={(event) => { setTemplateId(event.target.value); setNonce((n) => n + 1); }}>
              {templates.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </Select>
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-brown-soft">{template.description}</p>
          </div>
          {variants.length > 0 ? (
            <div>
              <Label htmlFor="comm-variant">Version</Label>
              <Select id="comm-variant" value={activeVariant} onChange={(event) => setVariant(event.target.value)}>
                {variants.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          {template.needsEvent ? (
            <div>
              <Label htmlFor="comm-event" hint="Real artwork, name, date, time and venue. The guest and the order are stand-ins.">Event</Label>
              <Select id="comm-event" value={eventId} onChange={(event) => setEventId(event.target.value)}>
                {events.length === 0 ? <option value="">No events to choose from</option> : null}
                {events.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {eventLabel(entry)}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-[0.8125rem]">
            <button type="button" onClick={() => setWidth('phone')} className={`min-h-10 rounded-full px-3 font-semibold ${width === 'phone' ? 'bg-teal text-linen' : 'text-brown-soft hover:bg-brown/8'}`}>
              Phone
            </button>
            <button type="button" onClick={() => setWidth('desktop')} className={`min-h-10 rounded-full px-3 font-semibold ${width === 'desktop' ? 'bg-teal text-linen' : 'text-brown-soft hover:bg-brown/8'}`}>
              Desktop
            </button>
            <a href={src} target="_blank" rel="noreferrer" className="ml-auto min-h-10 text-clay underline underline-offset-4">
              Open in a tab ↗
            </a>
            <a href={`${src}&format=text`} target="_blank" rel="noreferrer" className="min-h-10 text-clay underline underline-offset-4">
              Plain text ↗
            </a>
          </div>
        </div>

        <div className="border-t border-brown/12 pt-5">
          <h3 className="text-[1rem] font-semibold text-brown">Send a test</h3>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-brown-soft">
            Exactly what is previewed, to one address, with a TEST banner and “[TEST]” in the subject. Nobody else is emailed.
          </p>
          {canSend ? (
            <ActionForm action={sendTestEmail} className="mt-3 grid gap-3">
              <input type="hidden" name="template" value={template.id} />
              <input type="hidden" name="variant" value={activeVariant} />
              <input type="hidden" name="event" value={template.needsEvent ? eventId : ''} />
              <div>
                <Label htmlFor="comm-to">Send to</Label>
                <TextInput id="comm-to" name="to" type="email" required defaultValue={staffEmail} autoComplete="email" />
              </div>
              <div>
                <SubmitButton variant="secondary">Send test email</SubmitButton>
              </div>
            </ActionForm>
          ) : (
            <p className="mt-3 text-[0.875rem] text-brown-soft">Email sending is not configured yet, so tests cannot be sent. The preview still works.</p>
          )}
        </div>
      </div>

      <div className="min-w-0">
        <div className={`mx-auto overflow-hidden rounded-(--radius-md) border border-brown/15 bg-[#0d0805] ${width === 'phone' ? 'w-[390px] max-w-full' : 'w-full'}`}>
          <iframe key={src} src={src} title="Email preview" className="block h-[820px] w-full bg-[#0d0805]" sandbox="allow-popups allow-popups-to-escape-sandbox" />
        </div>
      </div>
    </div>
  );
}

/** One change, to the ticket holders of one event, after a tick in a box. */
export function EventUpdateForm({ events, enabled }: { events: EventOption[]; enabled: boolean }) {
  const [kind, setKind] = useState('time_change');
  const ticketed = events.filter((event) => event.ticketing);
  return (
    <ActionForm action={sendEventUpdate} className="grid gap-4">
      <div>
        <Label htmlFor="upd-event">Event</Label>
        <Select id="upd-event" name="event" required defaultValue={ticketed[0]?.id ?? ''}>
          {ticketed.length === 0 ? <option value="">No ticketed events</option> : null}
          {ticketed.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {eventLabel(entry)}
            </option>
          ))}
        </Select>
        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-brown-soft">Change the event itself first (date, time, venue) in the editor. This email shows what the event says now.</p>
      </div>
      <div>
        <Label htmlFor="upd-kind">What changed</Label>
        <Select id="upd-kind" name="kind" value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="time_change">The start time</option>
          <option value="date_change">The date</option>
          <option value="venue_change">The venue or location</option>
          <option value="postponed">Postponed — new date to follow</option>
          <option value="info">Something else (information update)</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="upd-message" hint={kind === 'info' ? 'Required: this is the update.' : 'Optional. A sentence or two in your own words.'}>
          A note to guests
        </Label>
        <TextArea id="upd-message" name="message" rows={4} maxLength={2000} />
      </div>
      <label htmlFor="upd-confirm" className="flex min-h-11 items-start gap-2.5 text-[0.9375rem] text-brown">
        <input id="upd-confirm" name="confirm" type="checkbox" value="yes" required className="mt-1 size-4 shrink-0 accent-[var(--color-coral)]" />
        <span>Send this to every paid ticket holder for the event above. I have previewed it.</span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton variant={enabled ? 'primary' : 'secondary'}>Email ticket holders</SubmitButton>
        {!enabled ? <span className="text-[0.8125rem] text-brown-soft">Guest delivery is off: each attempt is logged as skipped, nothing is sent.</span> : null}
      </div>
    </ActionForm>
  );
}
