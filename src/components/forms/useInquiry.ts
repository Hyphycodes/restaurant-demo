'use client';

import { submitInquiry } from '@/app/actions/inquiry';
import type { InquiryType } from '@/content/types';
import { useSubmission } from './useSubmission';

/**
 * The catering and private-event forms.
 *
 * Everything that is not "which enquiry is this" lives in `useSubmission`,
 * which the hiring and talent forms use too, so the double-submit guard, the
 * offline message and the focus move cannot drift apart between them.
 */
export function useInquiry(type: InquiryType) {
  return useSubmission((formData) => submitInquiry(type, formData));
}
