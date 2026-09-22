'use client';

import { isFreeHouseNight } from '@/content/admission';
import Link from 'next/link';
import { ActionForm, IntentField, SubmitButton } from '@/components/admin/ActionForm';
import { Card, FieldNote, Label, Select, TextArea, TextInput } from '@/components/admin/ui';
import type { EventSeries } from '@/content/types';
import { saveSeries, setSeriesPaused } from '@/server/actions/events';

const TICKET_POLICY = {
  required: 'Tickets are sold in advance',
  door: 'Pay at the door',
  free: 'Free entry',
  later: 'Ticket details to come',
};

function hhmm(minutes: number): string {
  const total = minutes % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * The defaults every night of a series inherits.
 *
 * Changing something here changes every future date at once — which is the whole
 * reason a series exists — and never touches a night that has been given its own
 * value. That guarantee is asserted in events.test.ts.
 */
export function SeriesEditor({
  series,
  canPublish,
  flyerOptions,
  flyerPreview,
  inheritingCount,
}: {
  series: EventSeries;
  canPublish: boolean;
  flyerOptions: { id: string; label: string }[];
  /** Rendered on the server — a client component cannot read the media store. */
  flyerPreview: React.ReactNode;
  /** How many upcoming nights use this rather than their own. */
  inheritingCount: number;
}) {
  return (
    <div className="grid gap-5">
      <ActionForm action={saveSeries} className="grid gap-5">
        <input type="hidden" name="slug" value={series.slug} />
        <IntentField name="publish" initial="false" />

        <Card title="The night">
          <div className="grid gap-4">
            <div>
              <Label htmlFor="title">Name</Label>
              <TextInput id="title" name="title" defaultValue={series.title} required maxLength={120} />
            </div>
            <div>
              <Label htmlFor="summary" hint="One line, used in listings.">
                Short line
              </Label>
              <TextInput id="summary" name="summary" defaultValue={series.summary} maxLength={200} />
            </div>
            <div>
              <Label htmlFor="description" hint="Shown on the night’s own page.">
                Description
              </Label>
              <TextArea
                id="description"
                name="description"
                rows={4}
                defaultValue={series.description}
                maxLength={1200}
              />
            </div>
          </div>
        </Card>

        <Card title="When">
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="weekday">Repeats every</Label><Select id="weekday" name="weekday" defaultValue={series.cadence.kind === 'weekly' ? series.cadence.weekday : 5}>
              {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((day, i) => <option key={day} value={i}>{day}</option>)}
            </Select></div>
            <div><Label htmlFor="seriesEndsOn">Last date (optional)</Label><TextInput id="seriesEndsOn" name="seriesEndsOn" type="date" defaultValue={series.seriesEndsOn ?? ''} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="startTime">Doors</Label>
              <TextInput
                id="startTime"
                name="startTime"
                type="time"
                defaultValue={hhmm(series.startMinutes)}
                required
              />
            </div>
            <div>
              <Label htmlFor="endTime">Finish</Label>
              <TextInput
                id="endTime"
                name="endTime"
                type="time"
                defaultValue={hhmm(series.endMinutes)}
                required
                aria-describedby="endTime-note"
              />
              <FieldNote id="endTime-note">
                A finish earlier than the doors means it runs past midnight — 22:00 to 02:00 is a
                four-hour night. Times are Chicago time.
              </FieldNote>
            </div>
          </div>
        </Card>

        <Card title="Getting in">
          {isFreeHouseNight(series.slug) ? <p className="mb-4 text-sm text-brown-soft">This weekly house night is free with no tickets. Create a separate special event for ticketed bookings.</p> : null}
          <div className="mb-4"><Label htmlFor="ticketUrl">Series ticket link (optional)</Label><TextInput id="ticketUrl" name="ticketUrl" type="url" readOnly={isFreeHouseNight(series.slug)} defaultValue={series.ticketUrl ?? ''} placeholder="https://" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="price" hint="Leave blank for “at the door”.">
                Entry price
              </Label>
              <TextInput
                id="price"
                name="price"
                readOnly={isFreeHouseNight(series.slug)}
                inputMode="decimal"
                defaultValue={series.priceCents != null ? String(series.priceCents / 100) : ''}
                placeholder="10"
              />
            </div>
            <div>
              <Label htmlFor="ticketPolicy">Tickets</Label>
              <Select id="ticketPolicy" name="ticketPolicy" defaultValue={series.ticketPolicy ?? 'required'}>
                {Object.entries(TICKET_POLICY).filter(([value]) => !isFreeHouseNight(series.slug) || value === 'free').map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="ageMin" hint="Leave blank for all ages.">
                Minimum age
              </Label>
              <TextInput
                id="ageMin"
                name="ageMin"
                inputMode="numeric"
                maxLength={3}
                defaultValue={series.ageMin != null ? String(series.ageMin) : ''}
              />
            </div>
            <div>
              <Label htmlFor="ageNote" hint="For example “Drinks 21+ with valid ID”.">
                Age note
              </Label>
              <TextInput id="ageNote" name="ageNote" defaultValue={series.ageNote ?? ''} maxLength={120} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="music" hint="Separate with commas.">
                Music
              </Label>
              <TextInput id="music" name="music" defaultValue={series.musicFormats.join(', ')} />
            </div>
          </div>
        </Card>

        {/* Artwork, shown as artwork. The value behind it is an id like
            `flyerSaturday`, which tells a person nothing about whether it
            is the right picture — so the picture is what is on screen. */}
        <Card title="Artwork for every night">
          <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
            {flyerPreview}

            <div className="grid gap-4">
              <div>
                <Label htmlFor="flyerAssetId" hint="Used on the events page and on this night's own page.">
                  Photo
                </Label>
                <Select
                  id="flyerAssetId"
                  name="flyerAssetId"
                  defaultValue={series.flyerAssetId ?? ''}
                  aria-describedby="flyer-note"
                >
                  <option value="">No artwork yet</option>
                  {flyerOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <FieldNote id="flyer-note">
                  {inheritingCount === 0
                    ? 'Every upcoming night has its own artwork, so changing this affects new dates only.'
                    : `Changes ${inheritingCount} upcoming ${inheritingCount === 1 ? 'night' : 'nights'} — every one that has not been given its own.`}{' '}
                  <Link href="/admin/media" className="text-clay underline underline-offset-4">
                    Upload a new photo
                  </Link>
                </FieldNote>
              </div>

              <div>
                <Label
                  htmlFor="flyerPrintedDate"
                  hint="Only if a date is printed on the picture itself."
                >
                  Date printed on the artwork
                </Label>
                <TextInput
                  id="flyerPrintedDate"
                  name="flyerPrintedDate"
                  defaultValue={series.flyerPrintedDate ?? ''}
                  placeholder="August 8th"
                  maxLength={60}
                  aria-describedby="printed-note"
                />
                <FieldNote id="printed-note">
                  A flyer with a date baked into it gets captioned with that date, so guests are
                  never left comparing it with the real one. Leave blank if there is no date on it.
                </FieldNote>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex flex-wrap gap-2">
          {canPublish ? (
            <SubmitButton name="publish" value="true">
              Save and publish
            </SubmitButton>
          ) : null}
          <SubmitButton variant="secondary" name="publish" value="false">
            {canPublish ? 'Save as a draft' : 'Save'}
          </SubmitButton>
        </div>
      </ActionForm>

      {canPublish ? (
        <Card title={series.paused ? 'This night is paused' : 'Pause this night'} tone="quiet">
          <p className="text-[0.9375rem] leading-relaxed text-brown-soft">
            {series.paused
              ? 'No new dates are going on the website. Everything you have set up is kept.'
              : 'Stops putting new dates on the website without deleting anything. Use it if the night is off for a while.'}
          </p>
          <div className="mt-3">
            <ActionForm action={setSeriesPaused}>
              <input type="hidden" name="slug" value={series.slug} />
              <input type="hidden" name="paused" value={series.paused ? 'false' : 'true'} />
              <SubmitButton variant={series.paused ? 'primary' : 'secondary'}>
                {series.paused ? 'Start it up again' : 'Pause it'}
              </SubmitButton>
            </ActionForm>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
