'use client';

import { useActionState } from 'react';
import { Label, Select, TextInput } from '@/components/admin/ui';
import { formatPrice } from '@/lib/format';
import { sellAtDoor, type DoorState } from '@/server/actions/door';

export function DoorSale({
  eventId,
  tiers,
}: {
  eventId: string;
  tiers: { id: string; name: string; priceCents: number; available: number | null }[];
}) {
  const [state, action, pending] = useActionState<DoorState, FormData>(sellAtDoor, { ok: true, message: '' });
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="eventId" value={eventId} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Label htmlFor="door-tier">Ticket</Label>
          <Select id="door-tier" name="tierId" required>
            {tiers.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.name} · {tier.priceCents === 0 ? 'Free' : formatPrice(tier.priceCents)}
                {tier.available !== null ? ` · ${tier.available} left` : ''}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="door-qty">How many</Label>
          <TextInput id="door-qty" name="quantity" type="number" inputMode="numeric" min={1} max={20} defaultValue={1} required />
        </div>
      </div>
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="text-[0.875rem] font-semibold text-brown">Paid how</legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-(--radius-sm) border border-brown/15 bg-ivory px-3 text-[0.9375rem] text-brown has-[:checked]:border-coral has-[:checked]:bg-coral/5">
          <input type="radio" name="kind" value="door" defaultChecked className="size-4 accent-[var(--color-coral)]" />
          Cash or card at the register
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-(--radius-sm) border border-brown/15 bg-ivory px-3 text-[0.9375rem] text-brown has-[:checked]:border-coral has-[:checked]:bg-coral/5">
          <input type="radio" name="kind" value="comp" className="size-4 accent-[var(--color-coral)]" />
          Comp (free)
        </label>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="door-name" hint="Optional.">Guest name</Label>
          <TextInput id="door-name" name="name" maxLength={120} autoComplete="off" />
        </div>
        <div>
          <Label htmlFor="door-reason" hint="Required for a comp.">Note</Label>
          <TextInput id="door-reason" name="reason" maxLength={300} placeholder="Owner's friend, birthday table…" />
        </div>
      </div>
      <div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-(--radius-sm) bg-coral px-5 text-[0.9375rem] font-semibold text-on-orange disabled:opacity-60"
        >
          {pending ? 'Recording…' : 'Sell and check in'}
        </button>
      </div>
      {state.message ? (
        <p role="status" className={`rounded-(--radius-sm) border px-3 py-2 text-[0.9375rem] ${state.ok ? 'border-success/40 bg-success/8 text-success' : 'border-danger/50 bg-danger/8 text-danger'}`}>
          {state.message}
          {state.codes?.length ? <span className="tabular block text-[0.875rem]">{state.codes.join(' · ')}</span> : null}
        </p>
      ) : null}
    </form>
  );
}
