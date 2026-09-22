'use client';

import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import type { VersionEntry } from '@/content/admin-types';
import { restoreVersionAction } from '@/server/actions/versions';

/**
 * Earlier versions of one record.
 *
 * Restoring brings the old wording back as a DRAFT rather than putting it
 * straight on the website — an undo that is itself reviewable, and one that costs
 * nothing to undo in turn.
 */
export function Versions({
  table,
  id,
  versions,
  canRestore,
}: {
  table: string;
  id: string;
  versions: VersionEntry[];
  canRestore: boolean;
}) {
  if (versions.length === 0) return null;

  return (
    <details className="rounded-(--radius-sm) border border-brown/15 bg-ivory">
      <summary className="flex min-h-11 cursor-pointer items-center px-3 text-[0.875rem] font-semibold text-brown">
        Earlier versions ({versions.length})
      </summary>
      <ul className="border-t border-brown/12 px-3 py-2">
        {versions.map((version) => (
          <li key={version.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-brown/10 py-2 last:border-b-0">
            <span className="tabular text-[0.8125rem] text-brown">
              {new Date(version.at).toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
            <span className="text-[0.8125rem] text-brown-soft">
              {version.actorName} · {version.label}
            </span>
            {canRestore ? (
              <ActionForm action={restoreVersionAction} className="ml-auto">
                <input type="hidden" name="table" value={table} />
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="versionId" value={version.id} />
                <SubmitButton variant="quiet">Bring this back</SubmitButton>
              </ActionForm>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="px-3 pb-3 text-[0.8125rem] leading-relaxed text-brown-soft">
        Restoring puts the old wording back as a draft, so you can look at it before it goes live.
      </p>
    </details>
  );
}
