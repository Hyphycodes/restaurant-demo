import 'server-only';

import type { BookingPaymentStatus, Contractor, ContractorBooking, ContractorService } from '@/content/staff-types';
import type { Db, Row } from '@/lib/db/types';
import type { Staff } from '@/server/auth';
import { eventSummaries } from './events';



function contractorFromRow(row: Row, upcoming: number, past: number): Contractor {
  return {
    id: String(row.id),
    name: String(row.name),
    companyName: (row.company_name as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    serviceType: (row.service_type as ContractorService) ?? 'other',
    defaultRateCents: (row.default_rate_cents as number | null) ?? null,
    paymentMethodNote: (row.payment_method_note as string | null) ?? null,
    w9Status: (row.w9_status as Contractor['w9Status']) ?? 'missing',
    notes: (row.notes as string | null) ?? null,
    active: row.active !== false && !row.archived_at,
    hasSignIn: Boolean(row.user_id),
    upcomingBookings: upcoming,
    pastBookings: past,
  };
}

export async function listContractors(db: Db, options: { includeInactive?: boolean; query?: string } = {}): Promise<Contractor[]> {
  const [rows, bookings] = await Promise.all([db.list<Row>('contractors', { orderBy: 'name' }), db.list<Row>('contractor_bookings')]);
  const now = Date.now();
  const needle = options.query?.trim().toLowerCase() ?? '';
  return rows
    .filter((row) => !row.archived_at && (options.includeInactive || row.active !== false))
    .map((row) => {
      const mine = bookings.filter((booking) => booking.contractor_id === row.id && booking.status !== 'cancelled');
      const upcoming = mine.filter((booking) => booking.starts_at && Date.parse(String(booking.starts_at)) >= now).length;
      return contractorFromRow(row, upcoming, mine.length - upcoming);
    })
    .filter((contractor) => !needle || [contractor.name, contractor.companyName ?? '', contractor.email ?? '', contractor.phone ?? '', contractor.serviceType].join(' ').toLowerCase().includes(needle));
}

export async function getContractor(db: Db, id: string): Promise<Contractor | null> {
  return (await listContractors(db, { includeInactive: true })).find((contractor) => contractor.id === id) ?? null;
}

/**
 * The contractor an account belongs to, for the stripped-down experience a
 * DJ or an instructor signs in to. A contractor account with no row — or an
 * archived one — resolves to null and sees nothing.
 */
export async function findContractorByUser(db: Db, userId: string): Promise<Contractor | null> {
  try {
    const rows = await db.list<Row>('contractors', { where: { user_id: userId } });
    const row = rows.find((entry) => !entry.archived_at && entry.active !== false);
    return row ? (await getContractor(db, String(row.id))) : null;
  } catch {
    return null;
  }
}

export interface ContractorInput {
  name: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  serviceType: ContractorService;
  defaultRateCents: number | null;
  paymentMethodNote: string | null;
  w9Status: Contractor['w9Status'];
  notes: string | null;
  active: boolean;
}

export async function saveContractor(db: Db, id: string | null, input: ContractorInput): Promise<Row> {
  const row = {
    name: input.name,
    company_name: input.companyName,
    phone: input.phone,
    email: input.email,
    service_type: input.serviceType,
    default_rate_cents: input.defaultRateCents,
    payment_method_note: input.paymentMethodNote,
    w9_status: input.w9Status,
    notes: input.notes,
    active: input.active,
  };
  return id ? db.update<Row>('contractors', id, row) : db.insert<Row>('contractors', { ...row, created_at: new Date().toISOString() });
}

export async function bookingsFromRows(db: Db, rows: Row[]): Promise<ContractorBooking[]> {
  const [contractors, events] = await Promise.all([db.list<Row>('contractors'), eventSummaries(db, rows.map((row) => row.event_id as string | null).filter((id): id is string => Boolean(id)))]);
  const names = new Map(contractors.map((row) => [String(row.id), String(row.name)]));
  return rows.map((row) => {
    const event = row.event_id ? events.get(String(row.event_id)) ?? null : null;
    return {
      id: String(row.id),
      contractorId: String(row.contractor_id),
      contractorName: names.get(String(row.contractor_id)) ?? 'Contractor',
      locationId: (row.location_id as string | null) ?? null,
      eventId: (row.event_id as string | null) ?? null,
      eventTitle: event?.title ?? null,
      eventStartsAt: event?.startsAt ?? null,
      role: (row.role as ContractorService) ?? 'other',
      startsAt: (row.starts_at as string | null) ?? event?.startsAt ?? null,
      endsAt: (row.ends_at as string | null) ?? null,
      status: (row.status as ContractorBooking['status']) ?? 'tentative',
      agreedCents: Number(row.agreed_cents ?? 0),
      depositCents: Number(row.deposit_cents ?? 0),
      paidCents: Number(row.paid_cents ?? 0),
      paymentStatus: (row.payment_status as BookingPaymentStatus) ?? 'unpaid',
      paymentNote: (row.payment_note as string | null) ?? null,
      paidOn: (row.paid_on as string | null) ?? null,
      note: (row.note as string | null) ?? null,
      arrivalNote: (row.arrival_note as string | null) ?? null,
    };
  });
}

export async function listBookings(db: Db, filter: { contractorId?: string; eventId?: string; from?: string } = {}): Promise<ContractorBooking[]> {
  const where: Record<string, string> = {};
  if (filter.contractorId) where.contractor_id = filter.contractorId;
  if (filter.eventId) where.event_id = filter.eventId;
  const rows = await db.list<Row>('contractor_bookings', { where, orderBy: 'starts_at', desc: true });
  const bookings = await bookingsFromRows(db, rows);
  return filter.from ? bookings.filter((booking) => !booking.startsAt || booking.startsAt >= filter.from!) : bookings;
}

export interface BookingInput {
  contractorId: string;
  eventId: string | null;
  locationId: string | null;
  role: ContractorService;
  startsAt: string | null;
  endsAt: string | null;
  status: ContractorBooking['status'];
  agreedCents: number;
  depositCents: number;
  paidCents: number;
  paymentNote: string | null;
  paidOn: string | null;
  note: string | null;
  arrivalNote: string | null;
}

export function paymentStatusFor(agreed: number, paid: number): BookingPaymentStatus {
  if (paid <= 0) return 'unpaid';
  return paid >= agreed ? 'paid' : 'deposit_paid';
}

export async function saveBooking(db: Db, id: string | null, input: BookingInput, actor: Staff): Promise<{ before: Row | null; after: Row }> {
  const row = {
    contractor_id: input.contractorId,
    event_id: input.eventId,
    location_id: input.locationId,
    role: input.role,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    status: input.status,
    agreed_cents: input.agreedCents,
    deposit_cents: input.depositCents,
    paid_cents: input.paidCents,
    payment_status: paymentStatusFor(input.agreedCents, input.paidCents),
    payment_note: input.paymentNote,
    paid_on: input.paidCents > 0 ? (input.paidOn ?? new Date().toISOString().slice(0, 10)) : null,
    note: input.note,
    arrival_note: input.arrivalNote,
  };
  if (id) {
    const before = await db.get<Row>('contractor_bookings', id);
    const after = await db.update<Row>('contractor_bookings', id, row);
    return { before, after };
  }
  const after = await db.insert<Row>('contractor_bookings', { ...row, created_by: actor.source === 'supabase' ? actor.id : null, created_at: new Date().toISOString() });
  return { before: null, after };
}

export async function markBookingPaid(db: Db, id: string, note: string | null): Promise<{ before: Row; after: Row }> {
  const before = await db.get<Row>('contractor_bookings', id);
  if (!before) throw new Error('That booking no longer exists.');
  const after = await db.update<Row>('contractor_bookings', id, {
    paid_cents: before.agreed_cents,
    payment_status: 'paid',
    payment_note: note ?? before.payment_note ?? null,
    paid_on: new Date().toISOString().slice(0, 10),
  });
  return { before, after };
}
