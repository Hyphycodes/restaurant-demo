import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ isLocalDb: () => false }));
vi.mock('@/lib/supabase/server', () => ({
  isSupabaseConfigured: () => false,
  getServiceClient: () => null,
}));

import { contentTypeOf, isSubmissionPath, isUpload } from './uploads';

/**
 * The gate on somebody else's files.
 *
 * `isSubmissionPath` is the whole reason /admin/files cannot be turned into a
 * file browser: only a path this system minted itself — a folder we chose, a
 * uuid we generated, an extension we derived from a MIME type we accepted —
 * is ever fetched or signed.
 */

describe('an object path we minted', () => {
  it('is accepted', () => {
    expect(isSubmissionPath('resumes/0f9c2a1e-7b3d-4c58-9f21-6a8e5d4c3b2a.pdf')).toBe(true);
    expect(isSubmissionPath('talent/0f9c2a1e-7b3d-4c58-9f21-6a8e5d4c3b2a.jpg')).toBe(true);
  });

  it('is the only thing accepted', () => {
    const uuid = '0f9c2a1e-7b3d-4c58-9f21-6a8e5d4c3b2a';
    for (const candidate of [
      `../../${uuid}.pdf`,
      `resumes/../../etc/passwd`,
      `resumes/${uuid}.pdf/../../secret.pdf`,
      `media/${uuid}.pdf`,
      `employee-files/employees/1/card.pdf`,
      `resumes/notauuid.pdf`,
      `resumes/${uuid}`,
      `resumes/${uuid}.terriblylongextension`,
      '',
    ]) {
      expect(isSubmissionPath(candidate), candidate).toBe(false);
    }
  });
});

describe('what counts as an upload', () => {
  it('is a file with bytes in it, not an empty input', () => {
    expect(isUpload(new File(['x'], 'resume.pdf', { type: 'application/pdf' }))).toBe(true);
    expect(isUpload(new File([], '', { type: 'application/octet-stream' }))).toBe(false);
    expect(isUpload('resume.pdf')).toBe(false);
    expect(isUpload(null)).toBe(false);
  });
});

describe('serving one back', () => {
  it('names the type from the extension we chose, never from the client', () => {
    expect(contentTypeOf('resumes/x.pdf')).toBe('application/pdf');
    expect(contentTypeOf('talent/x.jpg')).toBe('image/jpeg');
    expect(contentTypeOf('talent/x.unknown')).toBe('application/octet-stream');
  });
});
