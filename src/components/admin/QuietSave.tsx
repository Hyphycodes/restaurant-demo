'use client';

import { useActionState, useRef, type ReactNode } from 'react';
import type { ActionState } from '@/content/admin-types';

/**
 * A form that saves itself.
 *
 * For the controls that are changed during service — a price, a sold-out mark —
 * where "change it, then find and press Save" is two actions for one decision,
 * and the second one is the one that gets forgotten. Changing the control IS
 * the save.
 *
 * It confirms in place rather than through the shared indicator at the bottom of
 * the window: the answer to "did that take?" belongs on the row you are looking
 * at, not somewhere else on the screen. And it confirms without moving anything
 * — the status sits in a slot that is always the same width, because a row that
 * grows by a line pushes the next dish out from under a thumb already on its way
 * down.
 */
export function QuietSave({
  action,
  children,
  className = '',
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  /** Receives the form's own handles: submit it, and read how it went. */
  children: (helpers: {
    save: () => void;
    state: ActionState;
    pending: boolean;
  }) => ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { ok: true, message: '' });
  const form = useRef<HTMLFormElement>(null);

  return (
    <form ref={form} action={formAction} className={className}>
      {children({ save: () => form.current?.requestSubmit(), state, pending })}
      {/* Hidden, but still the form's default button — so Enter in a text field
          saves, exactly as it would with a visible one. */}
      <button type="submit" hidden tabIndex={-1} aria-hidden="true" />
    </form>
  );
}

/**
 * The word beside a control that saves itself.
 *
 * "Not saved yet" is what makes the pattern honest: the moment you type into a
 * price it says, in advance, that something is outstanding. Nobody has to
 * discover that tapping away was the save.
 *
 * The slot is a fixed width and the words wrap inside it, so a row that is being
 * edited neither grows taller nor pushes the dropdown beside it out of line with
 * every other row on the screen.
 */
export function SaveMark({
  pending,
  saved,
  unsaved,
  error,
}: {
  pending: boolean;
  /** Bumped on each successful save, so the tick replays rather than sitting there. */
  saved: number;
  unsaved: boolean;
  error?: string;
}) {
  // A failure takes the whole width of the row and stays: it is the one case
  // where the words matter more than the row keeping its shape.
  if (error) {
    return (
      <span role="status" className="basis-full text-[0.8125rem] font-semibold text-danger">
        {error}
      </span>
    );
  }

  return (
    <span
      role="status"
      aria-live="polite"
      className="w-20 shrink-0 text-[0.6875rem] leading-tight"
    >
      {pending ? (
        <span className="text-brown-soft">Saving…</span>
      ) : unsaved ? (
        <span className="text-clay">Not saved yet</span>
      ) : saved > 0 ? (
        <span key={saved} className="admin-flash font-semibold text-success">
          ✓ Saved
        </span>
      ) : null}
    </span>
  );
}
