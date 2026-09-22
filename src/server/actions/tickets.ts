'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { signOrderToken } from '@/lib/ticketing/tokens';
import { getOrderByNumber } from '@/server/ticketing/orders';

/**
 * Unlock a tickets page with the email on the order.
 *
 * The signed link in the email is the normal way in. This is for the guest
 * who has the order number from a receipt and nothing else. A match redirects
 * to the signed link; a miss says so without confirming whether the order
 * exists.
 */
const schema = z.object({
  orderNumber: z.string().trim().min(5).max(20),
  email: z.string().trim().email().max(180),
});

export interface UnlockState {
  message: string;
}

export async function unlockTickets(_prev: UnlockState, formData: FormData): Promise<UnlockState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: 'Enter the email you used when you paid.' };

  const order = await getOrderByNumber(parsed.data.orderNumber);
  const email = parsed.data.email.toLowerCase();
  if (!order || !order.customerEmail || order.customerEmail.toLowerCase() !== email) {
    return { message: 'That email does not match this order. Check the receipt and try again.' };
  }
  redirect(`/tickets/${order.orderNumber}?t=${encodeURIComponent(signOrderToken(order.id))}`);
}
