import 'server-only';
import { DEMO_MODE } from '@/lib/demo';
import { getReadDb } from '@/lib/db';

import { cache } from 'react';
import type { OfferTier } from '@/lib/ticketing/offer';
import { getTicketingReadClient } from './db';

/**
 * `get_event_availability`, typed. The only availability read in the repo.
 */

export interface TierAvailability extends OfferTier {
  capacity: number | null;
  taken: number;
}

export interface EventAvailability {
  eventId: string;
  ticketingEnabled: boolean;
  capacity: number | null;
  taken: number;
  available: number | null;
  tiers: TierAvailability[];
}

interface RawTier {
  tier_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  seats_per_ticket: number;
  min_per_order: number;
  max_per_order: number;
  capacity: number | null;
  taken: number;
  available: number | null;
  on_sale: boolean;
}

interface Raw {
  event_id: string;
  ticketing_enabled: boolean;
  capacity: number | null;
  taken: number;
  available: number | null;
  tiers: RawTier[];
}

export function fromRaw(raw: Raw): EventAvailability {
  return {
    eventId: raw.event_id,
    ticketingEnabled: Boolean(raw.ticketing_enabled),
    capacity: raw.capacity ?? null,
    taken: Number(raw.taken ?? 0),
    available: raw.available ?? null,
    tiers: (raw.tiers ?? []).map((tier) => ({
      id: tier.tier_id,
      name: tier.name,
      description: tier.description ?? null,
      priceCents: Number(tier.price_cents),
      seatsPerTicket: Number(tier.seats_per_ticket ?? 1),
      minPerOrder: Number(tier.min_per_order ?? 0),
      maxPerOrder: Number(tier.max_per_order ?? 10),
      capacity: tier.capacity ?? null,
      taken: Number(tier.taken ?? 0),
      available: tier.available ?? null,
      onSale: Boolean(tier.on_sale),
    })),
  };
}

/** Availability for one event, or null when ticketing is not reachable. Never throws. */
export const getEventAvailability = cache(async (eventId: string): Promise<EventAvailability | null> => {
  if(DEMO_MODE){const rows=await getReadDb()?.list('ticket_tiers',{where:{event_id:eventId}})??[];if(!rows.length)return null;return {eventId,ticketingEnabled:true,capacity:60,taken:18,available:42,tiers:rows.map(r=>({id:String(r.id),name:String(r.name),description:String(r.description??''),priceCents:Number(r.price_cents),seatsPerTicket:1,minPerOrder:1,maxPerOrder:6,capacity:60,taken:18,available:42,onSale:true}))};}
  const client = getTicketingReadClient();
  if (!client) return null;
  try {
    const { data, error } = await client.rpc('get_event_availability', { p_event_id: eventId });
    if (error || !data) return null;
    return fromRaw(data as Raw);
  } catch (error) {
    console.error('[ticketing] availability unavailable:', error);
    return null;
  }
});
