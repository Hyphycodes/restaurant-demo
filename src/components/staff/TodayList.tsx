'use client';

import Link from 'next/link';
import { ActionForm } from '@/components/admin/ActionForm';
import type { TodayLine } from '@/server/staff/home';
import { changeTaskStatus } from '@/server/actions/staff/tasks';
import { tickChecklistItem } from '@/server/actions/staff/checklists';

/**
 * Everything that needs doing before close, as one list.
 *
 * A checklist line and a task assigned to you are the same thing to the
 * person holding the phone, so they are the same row here — the separate
 * "Tasks" destination the old app had was an artefact of two tables, not
 * of anyone's evening.
 *
 * A line that needs a photo or a note cannot be finished with one tap, so
 * it sends you to the checklist where the camera is rather than pretending.
 */
export function TodayList({ lines }: { lines: TodayLine[] }) {
  return (
    <ul className="staff-panel px-4">
      {lines.map((line) => (
        <li key={line.key}>
          <TodayRow line={line} />
        </li>
      ))}
    </ul>
  );
}

function TodayRow({ line }: { line: TodayLine }) {
  const needsMore = !line.done && (line.requiresPhoto || line.requiresNote);
  const label = (
    <span className="min-w-0 flex-1">
      <span className={`block text-[1rem] leading-snug ${line.done ? 'text-brown-soft line-through' : 'font-semibold text-brown'}`}>{line.label}</span>
      {line.detail ? <span className={`mt-0.5 block text-[0.8125rem] ${line.overdue ? 'text-warning' : 'text-brown-soft'}`}>{line.detail}</span> : null}
      {needsMore ? <span className="mt-0.5 block text-[0.75rem] text-brown-soft">{line.requiresPhoto ? 'Needs a photo' : 'Needs a note'}</span> : null}
    </span>
  );

  if (needsMore && line.href) {
    return (
      <Link href={line.href} className="staff-row -mx-1 px-1 active:bg-brown/6">
        <Box done={false} />
        {label}
        <span className="shrink-0 text-[0.8125rem] font-semibold text-amber">Open</span>
      </Link>
    );
  }

  const action = line.kind === 'checklist' ? tickChecklistItem : changeTaskStatus;
  return (
    <ActionForm action={action} quiet className="staff-row -mx-1 px-1">
      {line.kind === 'checklist' ? (
        <>
          <input type="hidden" name="runId" value={line.runId ?? ''} />
          <input type="hidden" name="itemId" value={line.id} />
          <input type="hidden" name="done" value={line.done ? 'false' : 'true'} />
        </>
      ) : (
        <>
          <input type="hidden" name="id" value={line.id} />
          <input type="hidden" name="status" value={line.done ? 'open' : 'done'} />
        </>
      )}
      <button type="submit" aria-pressed={line.done} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left">
        <Box done={line.done} />
        {label}
      </button>
    </ActionForm>
  );
}

function Box({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-[0.875rem] font-bold transition-[background-color,border-color,transform] ${done ? 'scale-100 border-amber bg-amber text-on-orange' : 'border-brown/35 text-transparent'}`}
    >
      ✓
    </span>
  );
}
