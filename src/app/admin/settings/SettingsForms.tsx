'use client';

import { useState } from 'react';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { Checkbox, EmptyState, Label, Select, TextInput } from '@/components/admin/ui';
import { DAY_NAMES } from '@/content/site';
import type { DayHours, SiteSettings } from '@/content/types';
import {
  removeSpecialDay,
  saveAnnouncement,
  saveBusinessDetails,
  saveHours,
  saveSpecialDay,
} from '@/server/actions/settings';

export function BusinessDetails({ settings }: { settings: SiteSettings }) {
  const facebook = settings.socials.find((s) => s.platform === 'facebook')?.url ?? '';
  const tiktok = settings.socials.find((s) => s.platform === 'tiktok')?.url ?? '';
  const instagram = settings.socials.find((s) => s.platform === 'instagram')?.url ?? '';

  return (
    <ActionForm action={saveBusinessDetails} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="phone" hint="The number guests should call.">
            Phone
          </Label>
          <TextInput id="phone" name="phone" defaultValue={settings.phone.value} required />
        </div>
        <div>
          <Label htmlFor="street">Street</Label>
          <TextInput id="street" name="street" defaultValue={settings.street} required />
        </div>
        <div>
          <Label htmlFor="locality">Town</Label>
          <TextInput id="locality" name="locality" defaultValue={settings.locality} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="region">State</Label>
            <TextInput id="region" name="region" defaultValue={settings.region} required maxLength={4} />
          </div>
          <div>
            <Label htmlFor="postalCode">ZIP</Label>
            <TextInput id="postalCode" name="postalCode" defaultValue={settings.postalCode} required />
          </div>
        </div>
      </div>

      <fieldset className="grid gap-4 border-t border-brown/12 pt-4 sm:grid-cols-2">
        <legend className="sr-only">Links</legend>
        <div>
          <Label htmlFor="orderUrl" hint="Where “Order online” goes.">
            Ordering link
          </Label>
          <TextInput id="orderUrl" name="orderUrl" defaultValue={settings.orderUrl} inputMode="url" />
        </div>
        <div>
          <Label htmlFor="reservationUrl" hint="Where “Reserve a table” goes.">
            Booking link
          </Label>
          <TextInput
            id="reservationUrl"
            name="reservationUrl"
            defaultValue={settings.reservationUrl}
            inputMode="url"
          />
        </div>
        <div>
          <Label htmlFor="cateringOrderUrl" hint="Catering menu and pricing live here.">
            Catering link
          </Label>
          <TextInput
            id="cateringOrderUrl"
            name="cateringOrderUrl"
            defaultValue={settings.cateringOrderUrl}
            inputMode="url"
          />
        </div>
        <div>
          <Label htmlFor="directionsUrl">Directions link</Label>
          <TextInput
            id="directionsUrl"
            name="directionsUrl"
            defaultValue={settings.directionsUrl}
            inputMode="url"
          />
        </div>
        <div>
          <Label htmlFor="facebook">Facebook</Label>
          <TextInput id="facebook" name="facebook" defaultValue={facebook} inputMode="url" />
        </div>
        <div>
          <Label htmlFor="instagram">Instagram</Label>
          <TextInput id="instagram" name="instagram" defaultValue={instagram} inputMode="url" />
        </div>
        <div><Label htmlFor="tiktok">TikTok</Label><TextInput id="tiktok" name="tiktok" defaultValue={tiktok} inputMode="url" /></div>
      </fieldset>

      <div>
        <SubmitButton>Save details</SubmitButton>
      </div>
    </ActionForm>
  );
}

/**
 * The weekly schedule.
 *
 * A close time earlier than the open time means "after midnight" — 10am to 1am is
 * a normal Friday here — so it is accepted rather than rejected as invalid, and
 * the hint says so.
 */
export function HoursEditor({ hours }: { hours: DayHours[] }) {
  const [days, setDays] = useState(() =>
    Array.from({ length: 7 }, (_, day) => {
      const entry = hours.find((h) => h.day === day);
      const range = entry?.ranges[0];
      const format = (minutes: number) =>
        `${String(Math.floor((minutes % 1440) / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      return {
        day,
        closed: entry?.closed ?? !range,
        open: range ? format(range.openMinutes) : '10:00',
        close: range ? format(range.closeMinutes) : '22:00',
      };
    }),
  );

  const update = (day: number, patch: Partial<(typeof days)[number]>) =>
    setDays((current) => current.map((entry) => (entry.day === day ? { ...entry, ...patch } : entry)));

  return (
    <ActionForm action={saveHours} className="grid gap-3">
      <input type="hidden" name="hours" value={JSON.stringify(days)} />
      <ul className="grid gap-2">
        {days.map((entry) => (
          <li
            key={entry.day}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-brown/12 pb-2 last:border-b-0"
          >
            <span className="w-24 shrink-0 text-[0.9375rem] font-medium text-brown">
              {DAY_NAMES[entry.day]}
            </span>
            <label className="flex min-h-11 items-center gap-2 text-[0.875rem] text-brown-soft">
              <input
                type="checkbox"
                checked={entry.closed}
                onChange={(event) => update(entry.day, { closed: event.target.checked })}
                className="size-4 accent-[var(--color-coral)]"
              />
              Closed
            </label>
            {!entry.closed ? (
              <span className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`open-${entry.day}`}>
                  {DAY_NAMES[entry.day]} opens
                </label>
                <input
                  id={`open-${entry.day}`}
                  type="time"
                  value={entry.open}
                  onChange={(event) => update(entry.day, { open: event.target.value })}
                  className="tabular min-h-11 rounded-(--radius-sm) border border-brown/25 bg-linen px-2 text-[0.9375rem] text-brown"
                />
                <span className="text-brown-soft">to</span>
                <label className="sr-only" htmlFor={`close-${entry.day}`}>
                  {DAY_NAMES[entry.day]} closes
                </label>
                <input
                  id={`close-${entry.day}`}
                  type="time"
                  value={entry.close}
                  onChange={(event) => update(entry.day, { close: event.target.value })}
                  className="tabular min-h-11 rounded-(--radius-sm) border border-brown/25 bg-linen px-2 text-[0.9375rem] text-brown"
                />
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="text-[0.8125rem] text-brown-soft">
        A closing time earlier than the opening time means it closes after midnight — 10:00 to 01:00
        is a fifteen-hour day.
      </p>
      <div>
        <SubmitButton>Save hours</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function SpecialDays({
  days,
}: {
  days: { id: string; date: string; closed: boolean; note: string }[];
}) {
  return (
    <div className="grid gap-5">
      {days.length === 0 ? (
        <EmptyState>No changes coming up. Normal hours apply every day.</EmptyState>
      ) : (
        <ul className="grid gap-2">
          {days.map((day) => (
            <li
              key={day.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-brown/12 pb-2"
            >
              <span className="tabular w-28 shrink-0 text-[0.9375rem] font-semibold text-brown">
                {day.date}
              </span>
              <span className="min-w-0 flex-1 text-[0.9375rem] text-brown">
                {day.closed ? 'Closed all day' : 'Different hours'} · {day.note}
              </span>
              <ActionForm action={removeSpecialDay}>
                <input type="hidden" name="id" value={day.id} />
                <SubmitButton variant="quiet">Remove</SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
      )}

      <ActionForm action={saveSpecialDay} className="grid gap-4 border-t border-brown/12 pt-4">
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <Label htmlFor="special-date">Date</Label>
            <TextInput id="special-date" name="date" type="date" required />
          </div>
          <div>
            <Label htmlFor="special-open">Opens</Label>
            <TextInput id="special-open" name="open" type="time" defaultValue="10:00" />
          </div>
          <div>
            <Label htmlFor="special-close">Closes</Label>
            <TextInput id="special-close" name="close" type="time" defaultValue="22:00" />
          </div>
          <div className="flex items-end">
            <Checkbox id="special-closed" name="closed">
              Closed all day
            </Checkbox>
          </div>
        </div>
        <div>
          <Label htmlFor="special-note" hint="Guests see this — “Thanksgiving”, “Private party”.">
            What is it?
          </Label>
          <TextInput id="special-note" name="note" required maxLength={120} />
        </div>
        <div>
          <SubmitButton variant="secondary">Add the day</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}

export function AnnouncementEditor({
  announcement,
}: {
  announcement: {
    id: string;
    message: string;
    href: string;
    linkLabel: string;
    enabled: boolean;
    tone: 'default' | 'night';
  } | null;
}) {
  return (
    <ActionForm action={saveAnnouncement} className="grid gap-4">
      <input type="hidden" name="id" value={announcement?.id ?? ''} />

      <div>
        <Label htmlFor="message" hint="Keep it to one line — it sits above every page.">
          Message
        </Label>
        <TextInput
          id="message"
          name="message"
          defaultValue={announcement?.message ?? ''}
          required
          maxLength={240}
          placeholder="Taco Tuesday — $1 antipasti from 5pm"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="href" hint="Optional. Must start with https://">
            Link
          </Label>
          <TextInput id="href" name="href" defaultValue={announcement?.href ?? ''} inputMode="url" />
        </div>
        <div>
          <Label htmlFor="linkLabel" hint="The words on the link.">
            Link text
          </Label>
          <TextInput
            id="linkLabel"
            name="linkLabel"
            defaultValue={announcement?.linkLabel ?? ''}
            maxLength={40}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="tone">Style</Label>
          <Select id="tone" name="tone" defaultValue={announcement?.tone ?? 'default'}>
            <option value="default">Warm</option>
            <option value="night">Evening</option>
          </Select>
        </div>
        <div className="flex items-end">
          <Checkbox id="enabled" name="enabled" defaultChecked={announcement?.enabled}>
            Show it on the website
          </Checkbox>
        </div>
      </div>

      <div>
        <SubmitButton>Save banner</SubmitButton>
      </div>
    </ActionForm>
  );
}
