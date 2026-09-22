import { describe, expect, it } from 'vitest';
import { describeLink } from '@/content/talent';
import {
  applicationSchema,
  makeReference,
  MAX_LINKS,
  normalizeEmail,
  normalizeLink,
  normalizePhone,
  parseLinks,
  safeFileName,
  talentSchema,
} from './submissions';

/**
 * The validation two strangers a week depend on.
 *
 * What is pinned here is the stuff that either loses somebody's application
 * or lets something dangerous into the admin: the honeypot, the one-way-to-
 * reach-you rule, and the fact that a pasted link can never become a
 * `javascript:` URL a member of staff clicks.
 */

describe('phone normalisation', () => {
  it.each([
    ['3125550147', '(312) 555-0147'],
    ['312-555-0147', '(312) 555-0147'],
    ['+1 (312) 555 0147', '(312) 555-0147'],
    ['1.312.555.0147', '(312) 555-0147'],
  ])('%s becomes %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it('leaves anything that is not a ten-digit US number alone', () => {
    expect(normalizePhone(' +44 20 7946 0958 ')).toBe('+44 20 7946 0958');
    expect(normalizePhone('555')).toBe('555');
  });
});

describe('email normalisation', () => {
  it('trims and lowercases, because an inbox does not care and a duplicate check does', () => {
    expect(normalizeEmail('  Isabella@Example.COM ')).toBe('isabella@example.com');
  });
});

describe('links', () => {
  it('accepts what people actually paste', () => {
    expect(normalizeLink('instagram.com/demo-selector')).toBe('https://instagram.com/demo-selector');
    expect(normalizeLink('https://example.invalid/demo')).toBe(
      'https://example.invalid/demo',
    );
    expect(normalizeLink('http://example.com/mix')).toBe('https://example.com/mix');
  });

  it('refuses anything that is not a website', () => {
    // These are the ones that matter: a stored link is clicked by staff.
    expect(normalizeLink('javascript:alert(1)')).toBeNull();
    expect(normalizeLink('data:text/html,<script>')).toBeNull();
    expect(normalizeLink('@cosa-nostramexbar')).toBeNull();
    expect(normalizeLink('localhost')).toBeNull();
    expect(normalizeLink('   ')).toBeNull();
  });

  it('splits a pasted block, de-duplicates it and caps it', () => {
    const pasted = `
      instagram.com/one
      instagram.com/one
      tiktok.com/@two, soundcloud.com/three
    `;
    expect(parseLinks(pasted)).toEqual([
      'https://instagram.com/one',
      'https://tiktok.com/@two',
      'https://soundcloud.com/three',
    ]);

    const many = Array.from({ length: 30 }, (_, index) => `example.com/${index}`).join('\n');
    expect(parseLinks(many)).toHaveLength(MAX_LINKS);
  });

  it('reads back as something a person recognises', () => {
    expect(describeLink('https://instagram.com/djenzo').label).toBe('Instagram @djenzo');
    expect(describeLink('https://example.com/portfolio').host).toBe('example.com');
    // A row already in the database has to render even if it is nonsense.
    expect(describeLink('not a url').label).toBe('not a url');
  });
});

describe('file names', () => {
  it('keeps a readable name and removes what could be read as a path', () => {
    expect(safeFileName('Isabella Reed — résumé.pdf')).toBe('Isabella Reed — résumé.pdf');
    expect(safeFileName('../../etc/passwd')).toBe('..-..-etc-passwd');
    expect(safeFileName('   ')).toBe('attachment');
  });
});

describe('the job application', () => {
  const valid = {
    name: 'Isabella Reed',
    email: 'isabella@example.com',
    phone: '312 555 0147',
    openingId: 'open',
    availability: 'Weeknights after five, all day Saturday',
    experience: '',
    notes: '',
    company_website: '',
  };

  it('asks for five things and nothing more', () => {
    expect(applicationSchema.safeParse(valid).success).toBe(true);
  });

  it('will not accept a bot', () => {
    expect(applicationSchema.safeParse({ ...valid, company_website: 'spam' }).success).toBe(false);
  });

  it('refuses a missing role, a bad email and no availability', () => {
    expect(applicationSchema.safeParse({ ...valid, openingId: '' }).success).toBe(false);
    expect(applicationSchema.safeParse({ ...valid, email: 'nope' }).success).toBe(false);
    expect(applicationSchema.safeParse({ ...valid, availability: '' }).success).toBe(false);
  });
});

describe('the talent submission', () => {
  const valid = {
    name: 'Enzo Vale',
    email: '',
    phone: '312 555 0142',
    discipline: 'dj',
    pitch: 'Open-format Latin sets.',
    links: '',
    idea: '',
    notes: '',
    company_website: '',
  };

  it('takes a phone number on its own', () => {
    expect(talentSchema.safeParse(valid).success).toBe(true);
  });

  it('takes an email on its own', () => {
    expect(talentSchema.safeParse({ ...valid, phone: '', email: 'enzo@example.com' }).success).toBe(
      true,
    );
  });

  it('insists on one way to reach them, and says which field to fix', () => {
    const result = talentSchema.safeParse({ ...valid, phone: '', email: '' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path[0]).toBe('email');
  });

  it('rejects an unknown discipline rather than storing a typo', () => {
    expect(talentSchema.safeParse({ ...valid, discipline: 'astronaut' }).success).toBe(false);
  });

  it('will not accept a bot', () => {
    expect(talentSchema.safeParse({ ...valid, company_website: 'spam' }).success).toBe(false);
  });
});

describe('references', () => {
  it('are quotable, prefixed and dated', () => {
    const at = new Date('2026-09-20T18:00:00Z');
    expect(makeReference('JOB', at)).toMatch(/^JOB-260920-[0-9A-Z]{4}$/);
    expect(makeReference('TAL', at)).toMatch(/^TAL-260920-[0-9A-Z]{4}$/);
  });
});
