'use client';

import type { AvailabilityException, AvailabilityRule } from '@/content/staff-types';
import { WEEKDAY_LABEL, clockFromMinutes, formatDate } from '@/lib/staff/time';
import { addException, removeException, saveAvailability } from '@/server/actions/staff/profile';
import { ActionForm, Field, OneTap, Select, SubmitButton, TextInput } from '@/components/staff/forms';
import { Section } from '@/components/staff/ui';

/** Seven rows: a switch, and from/until when on. Then one-off days. */
export function AvailabilityForm({ rules, exceptions }: { rules: AvailabilityRule[]; exceptions: AvailabilityException[] }) {
  return (
    <div className="grid gap-7">
      <ActionForm action={saveAvailability} className="grid gap-3">
        {[1, 2, 3, 4, 5, 6, 0].map((weekday) => {
          const rule = rules.find((entry) => entry.weekday === weekday);
          const available = rule ? rule.available : true;
          return (
            <div key={weekday} className="staff-panel grid gap-2 px-4 py-3 sm:grid-cols-[8rem_1fr_1fr] sm:items-end">
              <label className="flex min-h-11 items-center gap-2.5 text-[0.9375rem] font-semibold text-brown">
                <input type="checkbox" name={`d${weekday}`} value="true" defaultChecked={available} className="size-5 shrink-0 accent-[var(--color-coral)]" />
                {WEEKDAY_LABEL[weekday]}
              </label>
              <Field id={`d${weekday}from`} label="From" hint="Blank = any time">
                <TextInput id={`d${weekday}from`} name={`d${weekday}from`} type="time" defaultValue={clockFromMinutes(rule?.startMinutes ?? null)} />
              </Field>
              <Field id={`d${weekday}until`} label="Until" hint="Blank = close">
                <TextInput id={`d${weekday}until`} name={`d${weekday}until`} type="time" defaultValue={clockFromMinutes(rule?.endMinutes ?? null)} />
              </Field>
            </div>
          );
        })}
        <div>
          <SubmitButton>Save availability</SubmitButton>
        </div>
      </ActionForm>

      <Section title="One-off days">
        <div className="staff-panel px-4 py-3">
          {exceptions.length === 0 ? <p className="py-2 text-[0.875rem] text-brown-soft">No exceptions coming up.</p> : null}
          <ul>
            {exceptions.map((exception) => (
              <li key={exception.id} className="staff-row">
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] font-semibold text-brown">{formatDate(exception.onDate)}</span>
                  <span className="block text-[0.8125rem] text-brown-soft">
                    {exception.available ? `Available${exception.startMinutes !== null ? ` from ${clockFromMinutes(exception.startMinutes)}` : ''}${exception.endMinutes !== null ? ` until ${clockFromMinutes(exception.endMinutes)}` : ''}` : 'Unavailable'}
                    {exception.note ? ` · ${exception.note}` : ''}
                  </span>
                </span>
                <OneTap action={removeException} fields={{ id: exception.id }} variant="quiet" quiet>
                  Remove
                </OneTap>
              </li>
            ))}
          </ul>
          <ActionForm action={addException} className="mt-2 grid gap-3 border-t border-brown/10 pt-3 sm:grid-cols-2">
            {(state) => (
              <>
                <Field id="onDate" label="Date" error={state.errors?.onDate}>
                  <TextInput id="onDate" name="onDate" type="date" required />
                </Field>
                <Field id="available" label="That day I am">
                  <Select id="available" name="available" defaultValue="false">
                    <option value="false">Unavailable</option>
                    <option value="true">Available (different hours)</option>
                  </Select>
                </Field>
                <Field id="from" label="From" hint="Only if available">
                  <TextInput id="from" name="from" type="time" />
                </Field>
                <Field id="until" label="Until">
                  <TextInput id="until" name="until" type="time" />
                </Field>
                <Field id="note" label="Note" hint="Optional">
                  <TextInput id="note" name="note" maxLength={120} />
                </Field>
                <div className="self-end">
                  <SubmitButton variant="secondary">Add day</SubmitButton>
                </div>
              </>
            )}
          </ActionForm>
        </div>
      </Section>
    </div>
  );
}
