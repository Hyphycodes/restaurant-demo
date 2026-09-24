'use client';

import type { ReactNode, RefObject } from 'react';
import { Button } from '@/components/primitives/Button';
import { Honeypot } from './Field';
import type { FormResult } from './useSubmission';


export function FormShell({
  children,
  submitLabel,
  phone,
  pending,
  result,
  formError,
  errorCount,
  formRef,
  statusId,
  onSubmit,
  /** Replaces the default "we have your message" panel. */
  success,
  /** The small print under the button. */
  privacyNote = 'We use your details only to reply to this enquiry.',
  /** A file input needs an encoding the default form does not use. */
  encType,
}: {
  children: ReactNode;
  submitLabel: string;
  phone: string;
  pending: boolean;
  result: FormResult | null;
  formError?: string;
  errorCount: number;
  formRef: RefObject<HTMLFormElement | null>;
  statusId: string;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  success?: { title: string; body: ReactNode };
  privacyNote?: string;
  encType?: string;
}) {
  if (result?.ok) {
    return (
      <div
        id={statusId}
        tabIndex={-1}
        role="status"
        className="rounded-(--radius-md) border-2 border-success bg-linen p-6"
      >
        <p className="display text-[clamp(1.375rem,2.4vw,1.75rem)] text-brown">
          {success?.title ?? 'Thanks — we have your message.'}
        </p>
        <div className="measure mt-3 text-[0.9375rem] leading-relaxed text-brown-soft">
          {success?.body ?? (
            <p>
              It is saved in our inbox for the Casa Aurelia team. If your date is soon, call us at{' '}
              <a
                href={`tel:+1${phone.replace(/\D/g, '')}`}
                className="tabular text-brown underline underline-offset-4"
              >
                {phone}
              </a>{' '}
              so we can confirm right away.
            </p>
          )}
        </div>
        <p className="tabular mt-4 text-[0.8125rem] text-brown-soft">
          Reference <span className="font-semibold text-brown">{result.reference}</span>
        </p>
      </div>
    );
  }

  const alert = formError ?? (errorCount > 0 ? 'Please check the highlighted fields below.' : null);

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate encType={encType} className="relative">
      <Honeypot />

      {alert ? (
        <p
          id={statusId}
          tabIndex={-1}
          role="alert"
          className="mb-6 rounded-(--radius-md) border-2 border-danger bg-linen px-4 py-3 text-[0.9375rem] font-medium text-danger"
        >
          {alert}
        </p>
      ) : null}

      <div className="grid gap-5">{children}</div>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Sending…' : submitLabel}
        </Button>
        <p className="measure text-[0.8125rem] text-brown-soft">{privacyNote}</p>
      </div>
    </form>
  );
}
