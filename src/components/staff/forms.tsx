'use client';

import type { ReactNode } from 'react';
import { ActionForm, IntentField, SubmitButton } from '@/components/admin/ActionForm';
import { Checkbox, FieldNote, Label, Select, TextArea, TextInput } from '@/components/admin/ui';
import type { ActionState } from '@/content/admin-types';

/**
 * Form pieces for the staff app. Thin wrappers over the admin's controls so a
 * field looks the same in both, plus the two things every staff form needs:
 * a one-button confirm, and a compact inline action (a row's "Done" button).
 */

export { ActionForm, IntentField, SubmitButton, Checkbox, FieldNote, Label, Select, TextArea, TextInput };

export function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <Label htmlFor={id} hint={hint}>
        {label}
      </Label>
      {children}
      {error ? (
        <FieldNote id={`${id}-error`} tone="error">
          {error}
        </FieldNote>
      ) : null}
    </div>
  );
}

/** A hidden-field form with one button. For "Clock in", "Mark done", "Approve". */
export function OneTap({ action, fields, children, variant = 'primary', quiet = false, confirm }: { action: (state: ActionState, form: FormData) => Promise<ActionState>; fields: Record<string, string>; children: ReactNode; variant?: 'primary' | 'secondary' | 'quiet' | 'danger'; quiet?: boolean; confirm?: string }) {
  return (
    <ActionForm
      action={action}
      quiet={quiet}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton variant={variant}>{children}</SubmitButton>
    </ActionForm>
  );
}

export function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-4 border-t border-brown/12 pt-4">
      <legend className="pr-3 text-[0.8125rem] font-semibold uppercase tracking-[0.1em] text-brown-soft">{legend}</legend>
      {children}
    </fieldset>
  );
}

/** Several checkboxes carrying the same name, for a multi-select that works without JavaScript. */
export function CheckGroup({ name, options, selected }: { name: string; options: { id: string; label: string }[]; selected: string[] }) {
  return (
    <div className="grid gap-1 sm:grid-cols-2">
      {options.map((option) => (
        <label key={option.id} className="flex min-h-11 items-center gap-2.5 text-[0.9375rem] text-brown">
          <input type="checkbox" name={name} value={option.id} defaultChecked={selected.includes(option.id)} className="size-4 shrink-0 accent-[var(--color-coral)]" />
          {option.label}
        </label>
      ))}
    </div>
  );
}
