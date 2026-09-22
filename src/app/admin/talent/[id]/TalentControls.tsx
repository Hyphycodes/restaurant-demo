'use client';

import { useActionState } from 'react';
import { TALENT_STATUSES, TALENT_STATUS_LABEL, type TalentSubmission } from '@/content/talent';
import type { ActionState } from '@/server/actions/shared';
import { addToContractors, updateTalent } from '@/server/actions/talent';



const IDLE: ActionState = { ok: true, message: '' };

const STATUS_HINT: Record<string, string> = {
  new: 'Nobody has looked yet.',
  interested: 'Worth a conversation.',
  contacted: 'We have reached out.',
  booked: 'They have a night.',
  featured: 'Somebody we put forward first.',
  archived: 'Not for us, or not right now.',
};

export function TalentControls({
  person,
  canBook,
}: {
  person: TalentSubmission;
  canBook: boolean;
}) {
  const [saveState, save, saving] = useActionState<ActionState, FormData>(updateTalent, IDLE);
  const [bookState, book, booking] = useActionState<ActionState, FormData>(addToContractors, IDLE);

  return (
    <div className="grid gap-5">
      <form action={save} className="grid gap-4">
        <input type="hidden" name="id" value={person.id} />

        <div>
          <label htmlFor="talent-status" className="block text-[0.875rem] font-semibold text-brown">
            Status
          </label>
          {/* Keyed on the stored value: "Add to the roster" moves somebody to
              Contacted server-side, and without a remount React would keep
              showing the old choice in a control that is now lying. */}
          <select
            key={person.status}
            id="talent-status"
            name="status"
            defaultValue={person.status}
            className="mt-1.5 block min-h-11 w-full rounded-(--radius-sm) border border-brown/25 bg-linen px-3 py-2 text-[0.9375rem] text-brown"
          >
            {TALENT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {TALENT_STATUS_LABEL[value]} — {STATUS_HINT[value]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="talent-notes" className="block text-[0.875rem] font-semibold text-brown">
            Internal notes
          </label>
          <textarea
            id="talent-notes"
            name="staffNotes"
            rows={4}
            defaultValue={person.staffNotes ?? ''}
            placeholder="Only your team sees this. Who spoke to them, what was agreed, what to ask next."
            className="mt-1.5 block w-full rounded-(--radius-sm) border border-brown/25 bg-linen px-3 py-2 text-[0.9375rem] text-brown"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-11 items-center justify-center rounded-(--radius-md) bg-coral px-5 font-semibold text-on-orange disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saveState.message ? (
            <p
              role="status"
              className={`text-[0.875rem] font-medium ${saveState.ok ? 'text-success' : 'text-danger'}`}
            >
              {saveState.message}
            </p>
          ) : null}
        </div>
      </form>

      {canBook && !person.contractorId ? (
        <form action={book} className="border-t border-brown/12 pt-4">
          <input type="hidden" name="id" value={person.id} />
          <button
            type="submit"
            disabled={booking}
            className="inline-flex min-h-11 items-center justify-center rounded-(--radius-md) border border-brown/30 px-5 text-[0.9375rem] font-semibold text-brown transition-colors hover:bg-brown/6 disabled:opacity-50"
          >
            {booking ? 'Adding…' : 'Add to the contractor roster'}
          </button>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-brown-soft">
            Creates their entry on the roster in the staff app, where bookings, rates and the W-9
            live. Nothing is sent to them.
          </p>
          {bookState.message ? (
            <p
              role="status"
              className={`mt-2 text-[0.875rem] font-medium ${bookState.ok ? 'text-success' : 'text-danger'}`}
            >
              {bookState.message}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
