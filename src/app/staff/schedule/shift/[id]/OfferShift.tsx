'use client';

import { useState } from 'react';
import { offerShift } from '@/server/actions/staff/coverage';
import { ActionForm, Field, Select, SubmitButton, TextArea } from '@/components/staff/forms';

export function OfferShift({ shiftId, swapOptions }: { shiftId: string; swapOptions: { id: string; label: string }[] }) {
  const [kind, setKind] = useState<'give_up' | 'swap' | 'cover'>('cover');
  return (
    <ActionForm action={offerShift} className="grid gap-4">
      <input type="hidden" name="shiftId" value={shiftId} />
      <Field id="kind" label="What do you want to do?">
        <Select id="kind" name="kind" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
          <option value="cover">Ask someone to cover it</option>
          <option value="give_up">Give it up</option>
          <option value="swap">Swap it for one of mine</option>
        </Select>
      </Field>
      {kind === 'swap' ? (
        <Field id="swapShiftId" label="Swap for" hint="The person who takes this shift gets one of yours in return.">
          <Select id="swapShiftId" name="swapShiftId" required>
            <option value="">Pick a shift…</option>
            {swapOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field id="note" label="Note" hint="Optional. Coworkers see it.">
        <TextArea id="note" name="note" rows={2} maxLength={300} placeholder="Something came up Saturday…" />
      </Field>
      <div>
        <SubmitButton>Offer this shift</SubmitButton>
      </div>
      <p className="text-[0.8125rem] text-brown-soft">The shift stays yours until a manager approves a change.</p>
    </ActionForm>
  );
}
