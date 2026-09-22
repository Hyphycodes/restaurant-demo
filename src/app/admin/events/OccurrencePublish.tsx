'use client';

import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { setOccurrencePublished } from '@/server/actions/events';

export function OccurrencePublish({ id, published }: { id: string; published: boolean }) {
  return (
    <ActionForm action={setOccurrencePublished} className="shrink-0">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="published" value={published ? 'false' : 'true'} />
      <SubmitButton variant={published ? 'secondary' : 'primary'}>
        {published ? 'Take off the website' : 'Publish'}
      </SubmitButton>
    </ActionForm>
  );
}
