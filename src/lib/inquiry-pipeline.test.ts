import { describe, expect, it } from 'vitest';
import type { InquiryRecord } from '@/content/types';
import {
  filterInquiries,
  groupByStage,
  inquiryFromRow,
  inquiryPlanSchema,
  inquiryStatusSchema,
  INQUIRY_STAGES,
  isFollowUpOverdue,
  normalizeInquiryStatus,
  relativeAge,
  summarizePipeline,
  summaryLine,
} from './inquiry-pipeline';

function inquiry(overrides: Partial<InquiryRecord> & { id: string }): InquiryRecord {
  return {
    reference: '',
    type: 'private-event',
    name: 'Fictional Guest',
    email: 'guest@example.invalid',
    phone: null,
    payload: {},
    status: 'new',
    notes: null,
    nextStep: null,
    followUpOn: null,
    statusChangedAt: '2026-09-01T15:00:00.000Z',
    createdAt: '2026-09-01T15:00:00.000Z',
    ...overrides,
  };
}

describe('inquiry status mapping', () => {
  it('treats the legacy in-progress value as Contacted', () => {
    expect(normalizeInquiryStatus('in-progress')).toBe('contacted');
  });

  it('keeps the five stages and falls back to New for anything unknown', () => {
    for (const stage of INQUIRY_STAGES) expect(normalizeInquiryStatus(stage)).toBe(stage);
    expect(normalizeInquiryStatus('archived')).toBe('new');
    expect(normalizeInquiryStatus(null)).toBe('new');
  });

  it('normalises a stored legacy row and fills the pipeline fields', () => {
    const record = inquiryFromRow({
      id: 'legacy',
      type: 'catering',
      name: 'Old Row',
      email: 'old@example.invalid',
      status: 'in-progress',
      created_at: '2026-01-02T10:00:00.000Z',
      payload: { guests: 20 },
    });
    expect(record.status).toBe('contacted');
    expect(record.nextStep).toBeNull();
    expect(record.followUpOn).toBeNull();
    expect(record.statusChangedAt).toBe('2026-01-02T10:00:00.000Z');
  });

  it('only accepts the five stages from the admin', () => {
    expect(inquiryStatusSchema.safeParse({ id: 'a', status: 'booked' }).success).toBe(true);
    expect(inquiryStatusSchema.safeParse({ id: 'a', status: 'in-progress' }).success).toBe(false);
  });

  it('validates the plan: a real date or none', () => {
    const base = { id: 'a', nextStep: 'Call back', notes: '' };
    expect(inquiryPlanSchema.safeParse({ ...base, followUpOn: '' }).success).toBe(true);
    expect(inquiryPlanSchema.safeParse({ ...base, followUpOn: '2026-10-01' }).success).toBe(true);
    expect(inquiryPlanSchema.safeParse({ ...base, followUpOn: '2026-02-30' }).success).toBe(false);
    expect(inquiryPlanSchema.safeParse({ ...base, followUpOn: '' , nextStep: 'x'.repeat(201) }).success).toBe(false);
  });
});

describe('pipeline grouping', () => {
  const list = [
    inquiry({ id: 'n1', status: 'new', createdAt: '2026-09-20T10:00:00.000Z' }),
    inquiry({ id: 'n2', status: 'new', createdAt: '2026-09-22T10:00:00.000Z' }),
    inquiry({ id: 'c1', status: 'contacted', followUpOn: '2026-09-30' }),
    inquiry({ id: 'c2', status: 'contacted', followUpOn: '2026-09-21' }),
    inquiry({ id: 'c3', status: 'contacted' }),
    inquiry({ id: 'b1', status: 'booked', payload: { date: '2026-11-20' }, statusChangedAt: '2026-09-10T15:00:00.000Z' }),
    inquiry({ id: 'b2', status: 'booked', payload: { date: '2026-10-05' }, statusChangedAt: '2026-08-10T15:00:00.000Z' }),
    inquiry({ id: 'x1', status: 'closed', type: 'catering', statusChangedAt: '2026-09-01T00:00:00.000Z' }),
    inquiry({ id: 'x2', status: 'closed', type: 'catering', statusChangedAt: '2026-09-15T00:00:00.000Z' }),
  ];

  it('puts every enquiry in exactly one of the five columns, in board order', () => {
    const groups = groupByStage(list);
    expect(Object.keys(groups)).toEqual(['new', 'contacted', 'planning', 'booked', 'closed']);
    expect(Object.values(groups).flat()).toHaveLength(list.length);
    expect(groups.planning).toEqual([]);
  });

  it('orders each column the way it is worked', () => {
    const groups = groupByStage(list);
    expect(groups.new.map((entry) => entry.id)).toEqual(['n2', 'n1']);
    expect(groups.contacted.map((entry) => entry.id)).toEqual(['c2', 'c1', 'c3']);
    expect(groups.booked.map((entry) => entry.id)).toEqual(['b2', 'b1']);
    expect(groups.closed.map((entry) => entry.id)).toEqual(['x2', 'x1']);
  });

  it('files a legacy in-progress record under Contacted', () => {
    const legacy = inquiry({ id: 'old', status: 'in-progress' as unknown as InquiryRecord['status'] });
    expect(groupByStage([legacy]).contacted.map((entry) => entry.id)).toEqual(['old']);
  });

  it('filters by type', () => {
    expect(filterInquiries(list, 'catering').map((entry) => entry.id)).toEqual(['x1', 'x2']);
    expect(filterInquiries(list, 'all')).toHaveLength(list.length);
  });

  it('summarises the board in one line', () => {
    const now = new Date('2026-09-23T17:00:00.000Z');
    const summary = summarizePipeline(list, now);
    expect(summary.counts).toEqual({ new: 2, contacted: 3, planning: 0, booked: 2, closed: 2 });
    expect(summary.bookedThisMonth).toBe(1);
    expect(summary.overdue).toBe(1);
    expect(summaryLine(summary)).toBe('2 new · 3 contacted · 1 booked this month — 1 follow-up overdue');
  });

  it('never calls a closed enquiry overdue', () => {
    expect(isFollowUpOverdue({ status: 'closed', followUpOn: '2026-01-01' }, '2026-09-23')).toBe(false);
    expect(isFollowUpOverdue({ status: 'planning', followUpOn: '2026-09-22' }, '2026-09-23')).toBe(true);
    expect(isFollowUpOverdue({ status: 'planning', followUpOn: '2026-09-23' }, '2026-09-23')).toBe(false);
  });
});

describe('relativeAge', () => {
  const now = new Date('2026-09-23T12:00:00.000Z');
  it('speaks like a person', () => {
    expect(relativeAge('2026-09-23T11:59:40.000Z', now)).toBe('just now');
    expect(relativeAge('2026-09-23T09:00:00.000Z', now)).toBe('3 hours ago');
    expect(relativeAge('2026-09-22T08:00:00.000Z', now)).toBe('yesterday');
    expect(relativeAge('2026-09-21T11:00:00.000Z', now)).toBe('2 days ago');
    expect(relativeAge('2026-09-02T12:00:00.000Z', now)).toBe('3 weeks ago');
  });
});
