'use client';

import { useActionState, useState } from 'react';
import { FieldNote, Label, TextArea, TextInput } from '@/components/admin/ui';
import type { InquiryStatus } from '@/content/types';
import { INQUIRY_STAGES, INQUIRY_STAGE_HINT, INQUIRY_STAGE_LABEL } from '@/lib/inquiry-pipeline';
import type { ActionState } from '@/server/actions/shared';
import { updateInquiryPlan, updateInquiryStatus } from '@/server/actions/inquiries';

const IDLE: ActionState = { ok: true, message: '' };

/**
 * The five stages as a row of buttons (a column on a phone). Each is its own
 * little form, so it works before hydration and with the keyboard alone:
 * Tab to a stage, Enter to move there.
 */
export function StageStepper({ id, status }: { id: string; status: InquiryStatus }) {
  const [state, move, pending] = useActionState<ActionState, FormData>(updateInquiryStatus, IDLE);
  const current = INQUIRY_STAGES.indexOf(status);

  return (
    <div>
      <ol className="grid gap-1.5 sm:grid-cols-5" aria-label="Stage">
        {INQUIRY_STAGES.map((stage, index) => {
          const isCurrent = stage === status;
          const done = index < current && status !== 'closed';
          return (
            <li key={stage} className="min-w-0">
              <form action={move}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="status" value={stage} />
                <button
                  type="submit"
                  disabled={pending}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-describedby={`stage-hint-${stage}`}
                  className={`flex min-h-11 w-full items-center gap-2 rounded-(--radius-sm) border px-3 py-2 text-left text-[0.875rem] font-semibold transition-colors duration-150 disabled:cursor-wait sm:flex-col sm:items-start sm:gap-1 ${
                    isCurrent
                      ? 'border-coral bg-coral text-on-orange'
                      : done
                        ? 'border-success/40 bg-success/8 text-brown hover:border-success'
                        : 'border-brown/20 text-brown-soft hover:border-brown/45 hover:text-brown'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`tabular inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[0.6875rem] ${
                      isCurrent ? 'bg-on-orange/15' : done ? 'bg-success/20 text-success' : 'bg-brown/10'
                    }`}
                  >
                    {done ? '✓' : index + 1}
                  </span>
                  <span className="min-w-0">
                    {INQUIRY_STAGE_LABEL[stage]}
                    {isCurrent ? <span className="sr-only"> (current stage)</span> : null}
                  </span>
                </button>
              </form>
              <span id={`stage-hint-${stage}`} className="sr-only">
                {INQUIRY_STAGE_HINT[stage]}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2.5 text-[0.8125rem] text-brown-soft">
        {INQUIRY_STAGE_LABEL[status]}: {INQUIRY_STAGE_HINT[status]} Choose a stage to move it.
      </p>
      <p role="status" className={`mt-1.5 min-h-5 text-[0.875rem] font-medium ${state.ok ? 'text-success' : 'text-danger'}`}>
        {pending ? 'Moving…' : state.message}
      </p>
    </div>
  );
}

function addDays(today: string, days: number): string {
  const at = new Date(`${today}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

/** Next step, a day to follow up, and notes for the team. */
export function PlanForm({
  id,
  nextStep,
  followUpOn,
  notes,
  today,
}: {
  id: string;
  nextStep: string | null;
  followUpOn: string | null;
  notes: string | null;
  /** The venue's today, from the server, so quick picks do not use the browser's clock zone. */
  today: string;
}) {
  const [state, save, pending] = useActionState<ActionState, FormData>(updateInquiryPlan, IDLE);
  const [followUp, setFollowUp] = useState(followUpOn ?? '');
  const errors = state.errors ?? {};

  return (
    <form action={save} className="grid gap-4">
      <input type="hidden" name="id" value={id} />

      <div>
        <Label htmlFor="inquiry-next-step" hint="One line the whole team can act on.">
          Next step
        </Label>
        <TextInput
          id="inquiry-next-step"
          name="nextStep"
          maxLength={200}
          defaultValue={nextStep ?? ''}
          placeholder="e.g. Send the Grand Evening menu and two dates"
          aria-invalid={errors.nextStep ? true : undefined}
          aria-describedby={errors.nextStep ? 'inquiry-next-step-error' : undefined}
        />
        {errors.nextStep ? (
          <FieldNote id="inquiry-next-step-error" tone="error">
            {errors.nextStep}
          </FieldNote>
        ) : null}
      </div>

      <div>
        <Label htmlFor="inquiry-follow-up" hint="Shows on the board, and turns amber once it has passed.">
          Follow up on
        </Label>
        <TextInput
          id="inquiry-follow-up"
          name="followUpOn"
          type="date"
          value={followUp}
          onChange={(event) => setFollowUp(event.target.value)}
          className="max-w-56"
          aria-invalid={errors.followUpOn ? true : undefined}
          aria-describedby={errors.followUpOn ? 'inquiry-follow-up-error' : undefined}
        />
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Quick follow-up dates">
          {[
            { label: 'Tomorrow', value: addDays(today, 1) },
            { label: 'In 3 days', value: addDays(today, 3) },
            { label: 'Next week', value: addDays(today, 7) },
            { label: 'Clear', value: '' },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => setFollowUp(option.value)}
              className="inline-flex min-h-9 items-center rounded-full border border-brown/25 px-3 text-[0.8125rem] font-semibold text-brown-soft transition-colors hover:border-brown/45 hover:text-brown"
            >
              {option.label}
            </button>
          ))}
        </div>
        {errors.followUpOn ? (
          <FieldNote id="inquiry-follow-up-error" tone="error">
            {errors.followUpOn}
          </FieldNote>
        ) : null}
      </div>

      <div>
        <Label htmlFor="inquiry-notes" hint="Only your team sees this.">
          Internal notes
        </Label>
        <TextArea
          id="inquiry-notes"
          name="notes"
          rows={5}
          maxLength={2000}
          defaultValue={notes ?? ''}
          placeholder="Who spoke to them, what was agreed, deposits, dietary needs."
          aria-invalid={errors.notes ? true : undefined}
          aria-describedby={errors.notes ? 'inquiry-notes-error' : undefined}
        />
        {errors.notes ? (
          <FieldNote id="inquiry-notes-error" tone="error">
            {errors.notes}
          </FieldNote>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-(--radius-md) bg-coral px-5 font-semibold text-on-orange disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save plan'}
        </button>
        <p role="status" className={`text-[0.875rem] font-medium ${state.ok ? 'text-success' : 'text-danger'}`}>
          {state.message}
        </p>
      </div>
    </form>
  );
}
