'use server';

import { z } from 'zod';
import { getStaff, staffCan } from '@/server/auth';
import { getTicketingClient } from '@/server/ticketing/db';
import { RESERVE_ERRORS, reserveErrorCode } from '@/server/ticketing/db';

/**
 * Selling and comping at the door.
 *
 * Both go through `reserve_order` and `fulfill_order`, exactly like a web
 * sale, so capacity stays honest and the sales number stays true. The only
 * differences are the `source`, that the money changed hands at the register
 * rather than at Stripe, and that the tickets are checked in on the spot.
 */

const schema = z.object({
  eventId: z.string().min(1),
  tierId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(20),
  kind: z.enum(['door', 'comp']),
  name: z.string().trim().max(120),
  reason: z.string().trim().max(300),
});

export interface DoorState {
  ok: boolean;
  message: string;
  codes?: string[];
}

export async function sellAtDoor(_prev: DoorState, formData: FormData): Promise<DoorState> {
  const staff = await getStaff();
  if (!staff || !staffCan(staff, 'content.publish')) return { ok: false, message: 'Only a manager or the owner can sell at the door.' };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: 'Check the ticket and quantity.' };
  const value = parsed.data;
  if (value.kind === 'comp' && !value.reason) return { ok: false, message: 'A comp needs a reason, even a short one.' };

  const client = getTicketingClient();
  if (!client) return { ok: false, message: 'Ticketing is not connected.' };

  const reserved = await client.rpc('reserve_order', {
    p_event_id: value.eventId,
    p_items: [{ tier_id: value.tierId, quantity: value.quantity }],
    p_promo_code: null,
    p_hold_minutes: 5,
    p_source: value.kind,
  });
  if (reserved.error) {
    const code = reserveErrorCode(reserved.error.message);
    return { ok: false, message: (code && RESERVE_ERRORS[code]) ?? 'Could not reserve those seats.' };
  }
  const order = reserved.data as { order_id: string; order_number: string; subtotal_cents: number; service_fee_cents: number; tax_cents: number };

  const patch: Record<string, unknown> = {
    customer_name: value.name || (value.kind === 'comp' ? 'Comp' : 'Door sale'),
    notes: value.kind === 'comp' ? `Comp: ${value.reason}` : value.reason ? `Door: ${value.reason}` : `Door sale by ${staff.name || staff.email}`,
  };
  if (value.kind === 'comp') {
    // Nothing paid: the discount absorbs the whole priced order so the row
    // still balances and the books show a comp, not a sale.
    patch.discount_cents = order.subtotal_cents + order.service_fee_cents + order.tax_cents;
    patch.total_cents = 0;
  }
  const updated = await client.from('orders').update(patch).eq('id', order.order_id);
  if (updated.error) return { ok: false, message: 'Could not record that order.' };

  const fulfilled = await client.rpc('fulfill_order', { p_order_id: order.order_id, p_charge_id: null, p_paid_at: new Date().toISOString() });
  if (fulfilled.error) return { ok: false, message: 'Reserved but could not issue the tickets. Try again.' };

  const by = staff.name || staff.email || 'door';
  await client
    .from('tickets')
    .update({ status: 'checked_in', checked_in_at: new Date().toISOString(), checked_in_by: by })
    .eq('order_id', order.order_id)
    .is('checked_in_at', null);

  const tickets = (fulfilled.data as { tickets?: { code: string }[] } | null)?.tickets ?? [];
  return {
    ok: true,
    message: `${value.kind === 'comp' ? 'Comped' : 'Sold'} ${value.quantity} and checked in. Order ${order.order_number}.`,
    codes: tickets.map((ticket) => ticket.code),
  };
}
