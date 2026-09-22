import type { RequirementItem } from '@/content/staff-types';
import { formatDate } from '@/lib/staff/time';
import { acknowledge, uploadDocument } from '@/server/actions/staff/requirements';
import { ActionForm, Checkbox, Field, SubmitButton, TextInput } from './forms';
import { Pill } from './ui';

export const STATE_PILL = {
  complete: { tone: 'good', label: 'Complete' },
  expiring: { tone: 'warn', label: 'Expiring soon' },
  expired: { tone: 'bad', label: 'Expired' },
  submitted: { tone: 'accent', label: 'Waiting for a manager' },
  missing: { tone: 'neutral', label: 'To do' },
  waived: { tone: 'neutral', label: 'Waived' },
} as const;

/**
 * One requirement, with the way to complete it right there: a checkbox to
 * acknowledge, an upload with its dates, a link out, or a note that a
 * manager does this part. The employee never has to find another screen.
 */
export function RequirementCard({ item, employeeId, forManager = false }: { item: RequirementItem; employeeId: string; forManager?: boolean }) {
  const pill = STATE_PILL[item.state];
  const open = item.state === 'missing' || item.state === 'expired' || item.state === 'expiring';
  const kind = item.type.kind;
  return (
    <div className="staff-panel px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.9375rem] font-semibold text-brown">{item.type.title}</p>
          {item.type.description ? <p className="mt-0.5 text-[0.875rem] text-brown-soft">{item.type.description}</p> : null}
          <p className="mt-1 text-[0.75rem] text-brown-soft">
            {item.type.required ? 'Required' : 'Optional'}
            {item.expiresOn ? ` · expires ${formatDate(item.expiresOn, 'short')}` : ''}
            {item.acknowledgedAt ? ` · acknowledged ${formatDate(item.acknowledgedAt.slice(0, 10), 'short')}` : ''}
            {item.verifiedAt ? ` · verified ${formatDate(item.verifiedAt.slice(0, 10), 'short')}` : ''}
            {item.credentialNumber ? ` · #${item.credentialNumber}` : ''}
          </p>
          {item.note ? <p className="mt-1 text-[0.875rem] text-warning">{item.note}</p> : null}
          {item.fileUrl ? (
            <a href={item.fileUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[0.875rem] font-semibold text-brown underline underline-offset-4">
              Open {item.fileName ?? 'file'} ↗
            </a>
          ) : item.fileName ? (
            <p className="mt-1 text-[0.875rem] text-brown-soft">{item.fileName}</p>
          ) : null}
        </div>
        <Pill tone={pill.tone}>{pill.label}</Pill>
      </div>

      {open && !forManager && kind === 'acknowledgement' ? (
        <ActionForm action={acknowledge} className="mt-3 border-t border-brown/10 pt-3">
          <input type="hidden" name="typeId" value={item.type.id} />
          {item.type.externalUrl ? (
            <a href={item.type.externalUrl} target="_blank" rel="noreferrer" className="mb-2 inline-block text-[0.875rem] font-semibold text-brown underline underline-offset-4">
              Read it ↗
            </a>
          ) : null}
          <Checkbox id={`ack-${item.type.id}`} name="confirm">
            I have read and understood this
          </Checkbox>
          <div className="mt-2">
            <SubmitButton variant="secondary">Acknowledge</SubmitButton>
          </div>
        </ActionForm>
      ) : null}

      {open && !forManager && kind === 'link' ? (
        <ActionForm action={acknowledge} className="mt-3 border-t border-brown/10 pt-3">
          <input type="hidden" name="typeId" value={item.type.id} />
          {item.type.externalUrl ? (
            <a href={item.type.externalUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-(--radius-sm) border border-brown/30 px-4 text-[0.9375rem] font-semibold text-brown">
              Open and complete it ↗
            </a>
          ) : null}
          <div className="mt-2">
            <Checkbox id={`link-${item.type.id}`} name="confirm">
              I completed this
            </Checkbox>
          </div>
          <div className="mt-2">
            <SubmitButton variant="secondary">Mark complete</SubmitButton>
          </div>
        </ActionForm>
      ) : null}

      {(open || item.state === 'submitted') && kind === 'upload' ? (
        <ActionForm action={uploadDocument} className="mt-3 grid gap-3 border-t border-brown/10 pt-3 sm:grid-cols-2">
          <input type="hidden" name="typeId" value={item.type.id} />
          <input type="hidden" name="employeeId" value={employeeId} />
          <div className="sm:col-span-2">
            <Field id={`file-${item.type.id}`} label={item.state === 'submitted' ? 'Replace the file' : 'Photo or PDF'}>
              <input id={`file-${item.type.id}`} name="file" type="file" accept="image/*,application/pdf" className="mt-1.5 block w-full text-[0.9375rem] text-brown file:mr-3 file:rounded-(--radius-sm) file:border file:border-brown/30 file:bg-transparent file:px-3 file:py-2 file:text-brown" />
            </Field>
          </div>
          <Field id={`issued-${item.type.id}`} label="Issued on">
            <TextInput id={`issued-${item.type.id}`} name="issuedOn" type="date" defaultValue={item.issuedOn ?? ''} />
          </Field>
          <Field id={`expires-${item.type.id}`} label="Expires on" hint={item.type.expiresAfterDays ? 'Worked out from the issue date if blank.' : 'If it has one.'}>
            <TextInput id={`expires-${item.type.id}`} name="expiresOn" type="date" defaultValue={item.expiresOn ?? ''} />
          </Field>
          <Field id={`number-${item.type.id}`} label="Certificate number" hint="Optional.">
            <TextInput id={`number-${item.type.id}`} name="credentialNumber" defaultValue={item.credentialNumber ?? ''} />
          </Field>
          <div className="self-end">
            <SubmitButton variant="secondary">{item.state === 'submitted' ? 'Update' : 'Upload'}</SubmitButton>
          </div>
        </ActionForm>
      ) : null}

      {open && !forManager && kind === 'manager_verify' ? <p className="mt-3 border-t border-brown/10 pt-3 text-[0.875rem] text-brown-soft">A manager marks this complete once it is in.{item.type.externalUrl ? ' ' : ''}{item.type.externalUrl ? <a href={item.type.externalUrl} target="_blank" rel="noreferrer" className="font-semibold text-brown underline underline-offset-4">Do it here ↗</a> : null}</p> : null}
      {open && kind === 'system' ? <p className="mt-3 border-t border-brown/10 pt-3 text-[0.875rem] text-brown-soft">{systemHint(item.type.systemKey)}</p> : null}
      {open && kind === 'training_module' && item.type.trainingModuleId ? (
        <p className="mt-3 border-t border-brown/10 pt-3 text-[0.875rem]">
          <a href={`/staff/training/${item.type.trainingModuleId}`} className="font-semibold text-brown underline underline-offset-4">
            Open the training module →
          </a>
        </p>
      ) : null}
    </div>
  );
}

function systemHint(key: string | null): string {
  switch (key) {
    case 'personal_details':
      return 'Fill in your phone and shirt size on your profile.';
    case 'emergency_contact':
      return 'Add an emergency contact on your profile.';
    case 'availability':
      return 'Set your weekly availability.';
    case 'positions':
      return 'A manager assigns your positions.';
    case 'location':
      return 'A manager assigns your location.';
    case 'first_shift':
      return 'Once a manager schedules your first shift, open it and confirm.';
    default:
      return '';
  }
}

export function systemHref(key: string | null): string | null {
  switch (key) {
    case 'personal_details':
    case 'emergency_contact':
      return '/staff/profile?edit=1';
    case 'availability':
      return '/staff/availability';
    case 'first_shift':
      return '/staff/schedule';
    default:
      return null;
  }
}
