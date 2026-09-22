'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, type FormEventHandler, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import type { ActionState } from '@/content/admin-types';
import { useSaveStatus } from './SaveStatus';

/**
 * The form wrapper every admin mutation uses.
 *
 * It exists so that four things are impossible to forget on an individual form:
 * a pending state, an announced result, a message that names the record, and a
 * way to go and look at the page that changed.
 *
 * Where it puts those things is the whole design:
 *
 *   - success goes to the one shared indicator (see SaveStatus), which sits over
 *     the page and clears itself, so saving ten things in a row does not leave
 *     ten boxes behind and does not move the row under your thumb;
 *   - failure stays here, next to the fields, and stays put — the fix is at the
 *     form, and a message that fades is no use to someone reading it.
 *
 * With no shell around it — the sign-in page — there is no shared indicator, and
 * the form falls back to showing everything itself.
 */

export type { ActionState };

export function ActionForm({
  action,
  children,
  className = '',
  /** Rendered after a successful save; receives the result. */
  onDone,
  onSubmit,
  /**
   * Skip the shared indicator entirely. For controls that confirm themselves in
   * place — a menu row saving as you type — where a second confirmation across
   * the screen is just another thing moving.
   */
  quiet = false,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode | ((state: ActionState) => ReactNode);
  className?: string;
  onDone?: (state: ActionState) => ReactNode;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  quiet?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { ok: true, message: '' });
  const announce = useSaveStatus();
  // A form shows its own confirmation only when nothing else will: no shell
  // around it, and not a control that confirms itself in place.
  const showsOwnSuccess = announce === null && !quiet;

  // Only ever clear an indicator this form put up. Another form's confirmation
  // is not ours to take away just because we mounted.
  const owned = useRef(false);

  useEffect(() => {
    if (!announce || quiet) return;

    if (pending) {
      owned.current = true;
      announce({ tone: 'busy', message: 'Saving…' });
      return;
    }

    if (state.ok && state.message) {
      owned.current = true;
      announce({ tone: 'ok', message: state.message, affected: state.affected });
      return;
    }

    // A failure is shown below, in the form. Take the spinner away.
    if (owned.current) {
      owned.current = false;
      announce(null);
    }
  }, [state, pending, announce, quiet]);

  return (
    <form action={formAction} className={className} onSubmit={onSubmit}>
      {typeof children === 'function' ? children(state) : children}

      <div aria-live="polite" className="empty:hidden">
        {state.message && (!state.ok || showsOwnSuccess) ? (
          <p
            className={`mt-3 rounded-(--radius-sm) border px-3 py-2 text-[0.875rem] leading-relaxed ${
              state.ok
                ? 'border-teal/20 bg-teal/6 text-brown'
                : 'border-danger/50 bg-danger/8 text-danger'
            }`}
          >
            {state.message}
          </p>
        ) : null}

        {/* Which pages this actually changed, as links. Opening in a new tab is
            the point: you check the page and the form is still where you left
            it, mid-edit. With the shared indicator up, it carries the link
            instead. */}
        {state.ok && showsOwnSuccess && state.affected?.length ? (
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-brown-soft">
            <span>See it on:</span>
            {state.affected.map((route) => (
              <Link
                key={route}
                href={route}
                className="font-semibold text-clay underline underline-offset-4"
                target="_blank"
              >
                {route === '/' ? 'the homepage' : route} ↗
              </Link>
            ))}
          </p>
        ) : null}

        {state.ok && state.message && onDone ? onDone(state) : null}
      </div>
    </form>
  );
}

/**
 * A submit button, optionally carrying an intent.
 *
 * `name`/`value` on the button is NOT used to carry the intent, and that is not a
 * style preference: React's `useActionState` builds the FormData from the form
 * itself and drops the submitter's name and value, so a "Save and publish" button
 * relying on `name="publish" value="true"` silently saves a draft instead. The
 * intent is written into a real hidden field on click, before the form submits,
 * where FormData will actually see it.
 */
export function SubmitButton({
  children,
  variant = 'primary',
  name,
  value,
  title,
}: {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  /** Field to set on click, e.g. `publish`. */
  name?: string;
  value?: string;
  title?: string;
}) {
  const { pending } = useFormStatus();

  const style = {
    primary:
      'bg-coral text-on-orange shadow-[0_6px_16px_rgba(225,85,58,0.22)] hover:bg-coral-deep hover:text-linen',
    secondary: 'border border-brown/30 text-brown hover:border-brown/50 hover:bg-brown/8',
    quiet: 'text-clay underline underline-offset-4 hover:underline-offset-[6px]',
    danger: 'border border-danger text-danger hover:bg-danger/8',
  }[variant];

  return (
    <button
      type="submit"
      title={title}
      disabled={pending}
      onClick={(event) => {
        if (!name) return;
        const form = event.currentTarget.form;
        const field = form?.elements.namedItem(name);
        if (field instanceof HTMLInputElement) field.value = value ?? '';
      }}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-(--radius-sm) px-4 text-[0.9375rem] font-semibold transition-all duration-150 active:translate-y-px disabled:opacity-60 ${style}`}
    >
      {pending ? (
        <>
          <span
            aria-hidden="true"
            className="admin-spin size-3.5 rounded-full border-2 border-transparent border-t-current"
          />
          Saving…
        </>
      ) : (
        children
      )}
    </button>
  );
}

/**
 * The hidden field a `SubmitButton` intent writes into.
 * Rendered by every form that offers both "publish" and "save as a draft".
 */
export function IntentField({ name, initial = '' }: { name: string; initial?: string }) {
  return <input type="hidden" name={name} defaultValue={initial} />;
}

/**
 * An icon-sized button for reordering.
 * Labelled, not just an arrow glyph, so it is announced properly.
 */
export function MoveButton({ direction, label }: { direction: 'up' | 'down'; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={label}
      title={label}
      className="inline-flex size-9 items-center justify-center rounded-(--radius-sm) border border-brown/20 text-brown-soft transition-colors hover:border-brown/40 hover:bg-brown/8 hover:text-brown disabled:opacity-40"
    >
      <span aria-hidden="true">{direction === 'up' ? '↑' : '↓'}</span>
    </button>
  );
}
