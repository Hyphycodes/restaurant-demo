'use client';

import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { Label, Select, TextInput } from '@/components/admin/ui';
import type { ResolvedEvent } from '@/content/types';
import { clearOccurrence, saveOccurrence, setTicketLinks } from '@/server/actions/events';

const STATUS = {
  scheduled: 'Going ahead',
  'sold-out': 'Sold out',
  cancelled: 'Cancelled',
  postponed: 'Postponed',
  free: 'Free entry',
};

/**
 * Change one night.
 *
 * Every field shows what it would inherit, so "blank" reads as "same as usual"
 * rather than as "nothing". Clearing everything removes the record entirely and
 * the night goes back to being an ordinary generated date — which is what "use
 * the series default" has to mean if it is to be trustworthy.
 */
export function OccurrenceEditor({
  event,
  date,
  seriesSlug,
  flyerOptions,
  artwork,
}: {
  event: ResolvedEvent;
  date: string;
  seriesSlug: string;
  flyerOptions: { id: string; label: string }[];
  /** Rendered on the server: what this night is showing right now. */
  artwork?: React.ReactNode;
}) {
  const overridden = new Set(event.overriddenFields);
  const inherited = (field: string, value: string) =>
    overridden.has(field) ? 'Changed for this night' : `Same as usual: ${value}`;

  return (
    <ActionForm action={saveOccurrence} className="grid gap-4">
      <input type="hidden" name="seriesSlug" value={seriesSlug} />
      <input type="hidden" name="date" value={date} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`status-${date}`}>What is happening</Label>
          <Select id={`status-${date}`} name="status" defaultValue={event.status}>
            {Object.entries(STATUS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label
            htmlFor={`price-${date}`}
            hint={inherited('priceCents', event.priceCents != null ? `$${event.priceCents / 100}` : 'at the door')}
          >
            Entry, this night only
          </Label>
          <TextInput
            id={`price-${date}`}
            name="price"
            inputMode="decimal"
            defaultValue={overridden.has('priceCents') && event.priceCents != null ? String(event.priceCents / 100) : ''}
            placeholder="Leave blank to keep the usual"
          />
        </div>
      </div>

      <div>
        <Label htmlFor={`tickets-${date}`} hint="Must start with https://. Blank uses the usual link for this date.">
          Ticket link, this night only
        </Label>
        <TextInput
          id={`tickets-${date}`}
          name="ticketUrl"
          inputMode="url"
          defaultValue={overridden.has('ticketUrl') ? (event.ticketUrl ?? '') : ''}
          placeholder="https://"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          {artwork ? <div className="mb-2">{artwork}</div> : null}
          <Label htmlFor={`flyer-${date}`} hint={inherited('flyerAssetId', event.flyerAssetId ?? 'none')}>
            Artwork, this night only
          </Label>
          <Select
            id={`flyer-${date}`}
            name="flyerAssetId"
            defaultValue={overridden.has('flyerAssetId') ? (event.flyerAssetId ?? '') : ''}
          >
            <option value="">Use the usual artwork</option>
            {flyerOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor={`title-${date}`} hint={inherited('title', event.title)}>
            Name, this night only
          </Label>
          <TextInput
            id={`title-${date}`}
            name="title"
            defaultValue={overridden.has('title') ? event.title : ''}
            placeholder="Leave blank to keep the usual"
            maxLength={120}
          />
        </div>
      </div>

      <div>
        <Label htmlFor={`note-${date}`} hint="Only your team sees this.">
          Note for the team
        </Label>
        <TextInput id={`note-${date}`} name="note" defaultValue={event.note ?? ''} maxLength={300} />
      </div>

      <div>
        <SubmitButton>Save this night</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Reset one night back to the series defaults by dropping its record. */
export function ResetOccurrence({ id }: { id: string }) {
  return (
    <ActionForm action={clearOccurrence}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="secondary">Use the usual details</SubmitButton>
    </ActionForm>
  );
}

/**
 * Paste a whole run of ticket links at once.
 *
 * Twelve inputs is a task people abandon halfway, and half a schedule with ticket
 * links is worse than none.
 */
export function BulkTicketLinks({
  seriesSlug,
  suggestion,
}: {
  seriesSlug: string;
  suggestion: string;
}) {
  return (
    <ActionForm action={setTicketLinks} className="grid gap-3">
      <input type="hidden" name="seriesSlug" value={seriesSlug} />
      <div>
        <Label htmlFor="bulk-lines" hint="One per line: the date, a space, then the link.">
          Paste ticket links
        </Label>
        <textarea
          id="bulk-lines"
          name="lines"
          rows={5}
          placeholder={suggestion}
          className="mt-1.5 block w-full rounded-(--radius-sm) border border-brown/25 bg-linen px-3 py-2 font-mono text-[0.8125rem] text-brown"
        />
      </div>
      <div>
        <SubmitButton variant="secondary">Save the links</SubmitButton>
      </div>
    </ActionForm>
  );
}
