'use client';

import { ActionForm, IntentField, SubmitButton } from '@/components/admin/ActionForm';
import { Label, Select, TextArea, TextInput } from '@/components/admin/ui';
import { saveOneTimeEvent } from '@/server/actions/events';

/**
 * What the event is: the facts a guest needs and a ticket depends on.
 *
 * Deliberately separate from how it looks. Someone correcting a door time
 * should not have to scroll past a colour picker, and someone art-directing a
 * card should not be one keystroke away from changing a date.
 */
export function OneOffFacts({
  id,
  facts,
  published,
  canPublish,
}: {
  id: string;
  published: boolean;
  canPublish: boolean;
  facts: {
    title: string;
    summary: string;
    description: string;
    date: string;
    startTime: string;
    endTime: string;
    ticketUrl: string;
    status: string;
    ageMin: string;
    venueName: string;
    price: string;
    music: string;
  };
}) {
  return (
    <ActionForm action={saveOneTimeEvent} className="grid gap-5">
      <input type="hidden" name="id" value={id} />
      <IntentField name="publish" />

      <div>
        <Label htmlFor="f-title">Event name</Label>
        <TextInput id="f-title" name="title" defaultValue={facts.title} required maxLength={120} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="f-date">Date</Label>
          <TextInput id="f-date" name="date" type="date" defaultValue={facts.date} required />
        </div>
        <div>
          <Label htmlFor="f-start">Doors</Label>
          <TextInput id="f-start" name="startTime" type="time" defaultValue={facts.startTime} required />
        </div>
        <div>
          <Label htmlFor="f-end" hint="Earlier than the start means it ends after midnight.">
            Ends
          </Label>
          <TextInput id="f-end" name="endTime" type="time" defaultValue={facts.endTime} required />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div><Label htmlFor="f-price">Entry price (optional)</Label><TextInput id="f-price" name="price" inputMode="decimal" defaultValue={facts.price} /></div>
        <div><Label htmlFor="f-music">Music / genre</Label><TextInput id="f-music" name="music" defaultValue={facts.music} /></div>
      </div>
      <div>
        <Label htmlFor="f-summary" hint="One line. It is what the card on the events page says.">
          Short line
        </Label>
        <TextInput id="f-summary" name="summary" defaultValue={facts.summary} maxLength={200} />
      </div>

      <div>
        <Label htmlFor="f-description">What should guests know?</Label>
        <TextArea id="f-description" name="description" rows={4} defaultValue={facts.description} maxLength={1200} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="f-tickets" hint="Where “Get tickets” goes. Usually the Tickeri page.">
            Ticket link
          </Label>
          <TextInput id="f-tickets" name="ticketUrl" defaultValue={facts.ticketUrl} inputMode="url" placeholder="https://" />
        </div>
        <div>
          <Label htmlFor="f-status">Is it on sale?</Label>
          <Select id="f-status" name="status" defaultValue={facts.status}>
            <option value="scheduled">On sale</option>
            <option value="sold-out">Sold out</option>
            <option value="free">Free entry</option>
            <option value="postponed">Postponed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="f-age" hint="Leave blank for all ages.">
            Minimum age
          </Label>
          <TextInput id="f-age" name="ageMin" defaultValue={facts.ageMin} inputMode="numeric" maxLength={3} />
        </div>
        <div>
          <Label htmlFor="f-venue" hint="Leave blank for the restaurant.">
            Where
          </Label>
          <TextInput id="f-venue" name="venueName" defaultValue={facts.venueName} maxLength={120} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {canPublish ? (
          <SubmitButton name="publish" value="true">
            {published ? 'Save changes' : 'Publish to the website'}
          </SubmitButton>
        ) : null}
        <SubmitButton variant="secondary" name="publish" value="false">
          Save as a draft
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
