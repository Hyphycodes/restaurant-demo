'use client';

import { useCallback, useId, useRef, useState, useTransition } from 'react';



export type FormResult =
  | { ok: true; reference: string }
  | { ok: false; fieldErrors: Record<string, string>; formError?: string };

const OFFLINE =
  'Could not connect. Your answers are still here — try again, or give us a call.';

export function useSubmission<R extends FormResult>(submit: (formData: FormData) => Promise<R>) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<R | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const statusId = useId();

  // The action is re-created on every render by the caller; the handler must
  // call the latest one without being re-created itself.
  const latest = useRef(submit);
  latest.current = submit;

  const errors = result && !result.ok ? result.fieldErrors : {};
  const formError = result && !result.ok ? result.formError : undefined;
  const succeeded = result?.ok === true;

  const onSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (pending || succeeded) return;

      const formData = new FormData(event.currentTarget);
      startTransition(async () => {
        let next: R;
        try {
          next = await latest.current(formData);
        } catch {
          next = { ok: false, fieldErrors: {}, formError: OFFLINE } as R;
        }
        setResult(next);
        if (next.ok) formRef.current?.reset();
        requestAnimationFrame(() => document.getElementById(statusId)?.focus());
      });
    },
    [pending, succeeded, statusId],
  );

  return { pending, result, errors, formError, succeeded, formRef, statusId, onSubmit };
}
