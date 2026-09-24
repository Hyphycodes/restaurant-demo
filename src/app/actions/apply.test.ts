import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * What happens when somebody presses Send.
 *
 * Three rules are pinned, and each one is a real way this could quietly go
 * wrong:
 *
 *   1. a success panel only ever appears after the row is really stored;
 *   2. it never claims an email was sent unless the service says one was —
 *      guest delivery ships switched off, so the default answer is "no";
 *   3. a résumé that fails to upload does not cost somebody their
 *      application.
 */

const mocks = vi.hoisted(() => ({
  configured: vi.fn(),
  client: vi.fn(),
  insert: vi.fn(),
  openings: vi.fn(),
  storeUpload: vi.fn(),
  storeUploads: vi.fn(),
  sendApplication: vi.fn(),
  sendTalent: vi.fn(),
  sendAlert: vi.fn(),
}));

vi.mock('next/headers', () => ({
  // A fresh address per call, so the shared rate limiter never fires here.
  headers: async () => new Headers({ 'x-forwarded-for': crypto.randomUUID() }),
}));
vi.mock('@/lib/db', () => ({ getReadDb: () => null, isLocalDb: () => false }));
vi.mock('@/lib/supabase/server', () => ({
  isSupabaseConfigured: mocks.configured,
  getServiceClient: mocks.client,
}));
vi.mock('@/server/content/hiring', () => ({ getPublicOpenings: mocks.openings }));
vi.mock('@/server/uploads', () => ({
  storeUpload: mocks.storeUpload,
  storeUploads: mocks.storeUploads,
}));
vi.mock('@/server/email/service', () => ({
  emailService: {
    sendApplicationReceived: mocks.sendApplication,
    sendTalentReceived: mocks.sendTalent,
    sendSubmissionAlert: mocks.sendAlert,
  },
}));

import { submitApplication, submitTalent } from './apply';

const BARTENDER = {
  id: 'opening-bartender',
  locationId: 'loc-chicago',
  title: 'Bartender',
  summary: null,
  employmentType: 'either' as const,
  active: true,
  sort: 10,
  archivedAt: null,
};

function applicationForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const fields = {
    name: 'Isabella Reed',
    email: 'Isabella@Example.COM',
    phone: '3125550147',
    openingId: BARTENDER.id,
    availability: 'Weeknights after five',
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function talentForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const fields = {
    name: 'Enzo Vale',
    phone: '3125550142',
    discipline: 'dj',
    pitch: 'Open-format Latin sets.',
    links: 'instagram.com/djenzo\njavascript:alert(1)',
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  // The shape PostgREST gives back: no row, because a public insert never
  // asks for one. See `storeSubmission`.
  mocks.insert.mockResolvedValue({ error: null });
  mocks.configured.mockReturnValue(true);
  mocks.client.mockReturnValue({ from: (table: string) => ({ insert: (row: unknown) => mocks.insert(table, row) }) });
  mocks.openings.mockResolvedValue([BARTENDER]);
  mocks.storeUpload.mockResolvedValue(null);
  mocks.storeUploads.mockResolvedValue([]);
  mocks.sendApplication.mockResolvedValue({ status: 'skipped' });
  mocks.sendTalent.mockResolvedValue({ status: 'skipped' });
  mocks.sendAlert.mockResolvedValue({ status: 'sent' });
});

afterEach(() => vi.clearAllMocks());

describe('a job application', () => {
  it('is stored with the real job title, normalised details and a reference', async () => {
    const result = await submitApplication(applicationForm());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reference).toMatch(/^JOB-/);

    const [table, row] = mocks.insert.mock.calls[0]!;
    expect(table).toBe('job_applications');
    expect(row).toMatchObject({
      position: 'Bartender',
      opening_id: BARTENDER.id,
      location_id: BARTENDER.locationId,
      email: 'isabella@example.com',
      phone: '(312) 555-0147',
      status: 'new',
    });
  });

  it('takes the title from the opening, never from the form', async () => {
    // Somebody posting `position=General Manager` must not invent a job.
    const data = applicationForm({ openingId: 'open' });
    data.set('position', 'General Manager');
    await submitApplication(data);
    expect(mocks.insert.mock.calls[0]![1]).toMatchObject({
      position: 'Something else',
      opening_id: null,
    });
  });

  it('will not claim an email that was not sent', async () => {
    const skipped = await submitApplication(applicationForm());
    expect(skipped.ok && skipped.emailed).toBe(false);

    mocks.sendApplication.mockResolvedValue({ status: 'sent' });
    const sent = await submitApplication(applicationForm());
    expect(sent.ok && sent.emailed).toBe(true);
  });

  it('is still saved when the confirmation email throws', async () => {
    mocks.sendApplication.mockRejectedValue(new Error('resend is down'));
    const result = await submitApplication(applicationForm());
    expect(result.ok).toBe(true);
    expect(result.ok && result.emailed).toBe(false);
  });

  it('fails honestly when there is nowhere to store it', async () => {
    mocks.configured.mockReturnValue(false);
    const result = await submitApplication(applicationForm());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.formError).toMatch(/could not be saved/i);
  });

  it('fails honestly when the row is rejected, and when the connection drops', async () => {
    mocks.insert.mockResolvedValue({ error: { message: 'violates row-level security policy' } });
    expect((await submitApplication(applicationForm())).ok).toBe(false);

    mocks.insert.mockRejectedValue(new Error('offline'));
    expect((await submitApplication(applicationForm())).ok).toBe(false);
  });

  it('never asks Postgres to return the row it just inserted', async () => {
    // `anon` may insert and may not read back, so a RETURNING clause would
    // turn a stored application into an error on the applicant's screen.
    const chain = { insert: vi.fn().mockResolvedValue({ error: null }), select: vi.fn() };
    mocks.client.mockReturnValue({ from: () => chain });
    expect((await submitApplication(applicationForm())).ok).toBe(true);
    expect(chain.select).not.toHaveBeenCalled();
  });

  it('rejects the honeypot without naming the trap', async () => {
    const result = await submitApplication(applicationForm({ company_website: 'bot' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors).toEqual({});
      expect(result.formError).not.toMatch(/company/i);
    }
  });

  it('returns field errors rather than storing a half-filled form', async () => {
    const result = await submitApplication(applicationForm({ email: 'nope', availability: '' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.email).toBeTruthy();
      expect(result.fieldErrors.availability).toBeTruthy();
    }
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

describe('a talent submission', () => {
  it('stores only the links that are really websites', async () => {
    const result = await submitTalent(talentForm());
    expect(result.ok).toBe(true);

    const [table, row] = mocks.insert.mock.calls[0]!;
    expect(table).toBe('talent_submissions');
    expect(row).toMatchObject({
      name: 'Enzo Vale',
      discipline: 'dj',
      phone: '(312) 555-0142',
      email: null,
      links: ['https://instagram.com/djenzo'],
      status: 'new',
    });
  });

  it('sends no confirmation when there is no email to send it to', async () => {
    const result = await submitTalent(talentForm());
    expect(mocks.sendTalent).not.toHaveBeenCalled();
    expect(result.ok && result.emailed).toBe(false);
  });

  it('confirms to an address when one was given', async () => {
    mocks.sendTalent.mockResolvedValue({ status: 'sent' });
    const result = await submitTalent(talentForm({ email: 'Enzo@Example.com' }));
    expect(result.ok && result.emailed).toBe(true);
    expect(mocks.sendTalent).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'enzo@example.com' }),
    );
  });

  it('needs one way to reach them', async () => {
    const result = await submitTalent(talentForm({ phone: '', email: '' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.email).toBeTruthy();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('tells Casa Aurelia about it without letting that decide the outcome', async () => {
    mocks.sendAlert.mockRejectedValue(new Error('no alert address'));
    expect((await submitTalent(talentForm())).ok).toBe(true);
  });
});
