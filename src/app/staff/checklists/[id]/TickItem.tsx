'use client';

import type { ChecklistRunItem } from '@/content/staff-types';
import { tickChecklistItem } from '@/server/actions/staff/checklists';
import { ActionForm, SubmitButton, TextInput } from '@/components/staff/forms';

/** One line of a checklist: a big tap to tick it, and a photo or note when the line asks for one. */
export function TickItem({ runId, item, locked }: { runId: string; item: ChecklistRunItem; locked: boolean }) {
  const done = Boolean(item.completedAt);
  const needsMore = !done && (item.requiresPhoto || item.requiresNote);
  return (
    <ActionForm action={tickChecklistItem} quiet className="staff-row flex-wrap">
      <input type="hidden" name="runId" value={runId} />
      <input type="hidden" name="itemId" value={item.id} />
      <input type="hidden" name="done" value={done ? 'false' : 'true'} />
      <button
        type="submit"
        disabled={locked}
        aria-pressed={done}
        className={`flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-60 ${done ? 'text-brown-soft' : 'text-brown'}`}
      >
        <span aria-hidden="true" className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 ${done ? 'border-amber bg-amber text-on-orange' : 'border-brown/40'}`}>
          {done ? '✓' : ''}
        </span>
        <span className="min-w-0">
          <span className={`block text-[1rem] ${done ? 'line-through' : 'font-semibold'}`}>{item.label}</span>
          {done && item.completedByName ? <span className="block text-[0.75rem]">{item.completedByName}</span> : null}
          {item.note ? <span className="block text-[0.8125rem]">{item.note}</span> : null}
          {item.photoPath ? <span className="block text-[0.75rem] text-success">Photo attached</span> : null}
        </span>
      </button>
      {needsMore ? (
        <div className="flex w-full flex-wrap items-end gap-2 pl-10">
          {item.requiresPhoto ? <input type="file" name="photo" accept="image/*" capture="environment" className="min-w-0 flex-1 text-[0.875rem] text-brown file:mr-2 file:rounded-(--radius-sm) file:border file:border-brown/30 file:bg-transparent file:px-2 file:py-1.5 file:text-brown" /> : null}
          {item.requiresNote ? <TextInput name="note" placeholder="Note…" className="min-w-0 flex-1" /> : null}
          <SubmitButton variant="secondary">Done</SubmitButton>
        </div>
      ) : null}
    </ActionForm>
  );
}
