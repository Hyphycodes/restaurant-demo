import type { OpsComment } from '@/content/staff-types';
import { postComment } from '@/server/actions/staff/notifications';
import { formatRelative } from '@/lib/staff/time';
import { ActionForm, SubmitButton, TextArea } from './forms';
import { Section } from './ui';

/** The comment thread under a task, a request, an incident. Operational, not chat. */
export function Comments({ entityType, entityId, comments }: { entityType: string; entityId: string; comments: OpsComment[] }) {
  return (
    <Section title="Comments" count={comments.length}>
      <div className="staff-panel px-4 py-2">
        {comments.length === 0 ? <p className="py-3 text-[0.875rem] text-brown-soft">No comments yet.</p> : null}
        <ul className="divide-y divide-brown/10">
          {comments.map((comment) => (
            <li key={comment.id} className="py-3">
              <p className="text-[0.8125rem] text-brown-soft">
                <span className="font-semibold text-brown">{comment.mine ? 'You' : comment.authorName}</span> · {formatRelative(comment.createdAt)}
              </p>
              <p className="mt-1 whitespace-pre-line text-[0.9375rem] text-brown">{comment.body}</p>
            </li>
          ))}
        </ul>
        <ActionForm action={postComment} className="border-t border-brown/10 py-3">
          <input type="hidden" name="entityType" value={entityType} />
          <input type="hidden" name="entityId" value={entityId} />
          <label htmlFor={`comment-${entityId}`} className="sr-only">
            Add a comment
          </label>
          <TextArea id={`comment-${entityId}`} name="body" rows={2} placeholder="Add a comment…" required maxLength={2000} />
          <div className="mt-2">
            <SubmitButton variant="secondary">Post</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </Section>
  );
}
