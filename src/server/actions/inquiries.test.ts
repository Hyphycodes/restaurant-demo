import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalDb } from '@/lib/db/local';
import type { Row } from '@/lib/db/types';

const context = vi.hoisted(() => ({
  db: null as unknown,
  staff: { id: 'qa', name: 'QA', email: 'qa@example.com', role: 'editor', sections: [], active: true, source: 'local' },
  allowed: true,
}));
vi.mock('@/lib/db', () => ({ getReadDb: () => context.db, getWriteDb: async () => context.db }));
vi.mock('@/server/auth', () => ({
  requireCapability: async () => {
    if (!context.allowed) throw new Error('permission denied');
    return context.staff;
  },
  staffCan: () => context.allowed,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { updateInquiryPlan, updateInquiryStatus } from './inquiries';

const idle = { ok: true, message: '' };
const fd = (data: Record<string, string>) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(data)) form.set(key, value);
  return form;
};

let directory: string;
let db: LocalDb;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'casa-aurelia-inquiries-'));
  db = new LocalDb(directory, () => ({
    inquiries: [
      {
        id: 'legacy',
        type: 'private-event',
        name: 'Fictional Guest',
        email: 'guest@example.invalid',
        status: 'in-progress',
        created_at: '2026-09-01T15:00:00.000Z',
        payload: { guests: 12 },
      },
    ],
  }));
  context.db = db;
  context.allowed = true;
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('enquiry pipeline actions', () => {
  it('moves a legacy enquiry to a new stage and stamps when it moved', async () => {
    const result = await updateInquiryStatus(idle, fd({ id: 'legacy', status: 'planning' }));
    expect(result).toMatchObject({ ok: true, message: 'Moved to Planning.' });
    const row = await db.get<Row>('inquiries', 'legacy');
    expect(row?.status).toBe('planning');
    expect(Date.parse(String(row?.status_changed_at))).toBeGreaterThan(Date.parse('2026-09-01T15:00:00.000Z'));
  });

  it('does not restamp when the stage is unchanged (legacy in-progress is already Contacted)', async () => {
    const result = await updateInquiryStatus(idle, fd({ id: 'legacy', status: 'contacted' }));
    expect(result.ok).toBe(true);
    expect((await db.get<Row>('inquiries', 'legacy'))?.status_changed_at).toBeUndefined();
  });

  it('rejects an unknown stage and a missing enquiry', async () => {
    expect((await updateInquiryStatus(idle, fd({ id: 'legacy', status: 'in-progress' }))).ok).toBe(false);
    expect((await updateInquiryStatus(idle, fd({ id: 'nope', status: 'booked' }))).ok).toBe(false);
  });

  it('saves the plan and clears empty fields to null', async () => {
    const result = await updateInquiryPlan(
      idle,
      fd({ id: 'legacy', nextStep: '  Send the menu  ', followUpOn: '2026-10-01', notes: '' }),
    );
    expect(result.ok).toBe(true);
    expect(await db.get<Row>('inquiries', 'legacy')).toMatchObject({
      next_step: 'Send the menu',
      follow_up_on: '2026-10-01',
      notes: null,
    });
  });

  it('names the bad field when the follow-up date is not a date', async () => {
    const result = await updateInquiryPlan(idle, fd({ id: 'legacy', nextStep: '', followUpOn: '2026-13-40', notes: '' }));
    expect(result.ok).toBe(false);
    expect(result.errors?.followUpOn).toBeTruthy();
  });

  it('refuses without the enquiries capability', async () => {
    context.allowed = false;
    const result = await updateInquiryStatus(idle, fd({ id: 'legacy', status: 'booked' }));
    expect(result.ok).toBe(false);
    expect((await db.get<Row>('inquiries', 'legacy'))?.status).toBe('in-progress');
  });
});

describe('demo enquiries', () => {
  it('seed every stage with records shaped like a real submission', async () => {
    const { buildDemoRecords } = await import('@/server/demo-records');
    const { inquiryFromRow, INQUIRY_STAGES } = await import('@/lib/inquiry-pipeline');
    const rows = buildDemoRecords().inquiries ?? [];
    const records = rows.map(inquiryFromRow);
    expect(records.length).toBeGreaterThanOrEqual(8);
    for (const stage of INQUIRY_STAGES) expect(records.some((entry) => entry.status === stage)).toBe(true);
    for (const row of rows) {
      expect(String(row.email)).toMatch(/@example\.invalid$/);
      expect(String(row.phone)).toMatch(/^\(312\) 555-01\d\d$/);
      const payload = row.payload as Record<string, unknown>;
      expect(typeof payload.guests).toBe('number');
      expect(typeof payload.notes).toBe('string');
      expect(payload).not.toHaveProperty('message');
    }
  });
});
