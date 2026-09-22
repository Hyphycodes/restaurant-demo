'use client';

import type { OpsRole } from '@/content/staff-types';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { setRolePreview } from '@/server/actions/staff/preview';

/**
 * "What does a bartender actually see?"
 *
 * An access-control system nobody can look at is one nobody maintains. This
 * answers the question in one tap, without anyone signing in as anyone: the
 * owner's session narrows for an hour, the whole app re-renders through the
 * same capability checks the real account would hit, and a banner across the
 * top makes it impossible to forget.
 */
export function RolePreview({ current }: { current: OpsRole | null }) {
  const options: { value: string; label: string; detail: string }[] = [
    { value: 'employee', label: 'Staff', detail: 'Home, schedule, training, profile' },
    { value: 'manager', label: 'Manager', detail: 'Everything but owner-only settings' },
    { value: 'contractor', label: 'Contractor', detail: 'Their bookings, and nothing else' },
  ];
  return (
    <section className="staff-panel px-4 py-4">
      <h2 className="text-[0.8125rem] font-semibold uppercase tracking-[0.1em] text-brown-soft">See it the way they see it</h2>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-brown-soft">
        Narrows your own account for an hour so you can check what each role can open. Nothing signs in as anybody, and your access comes straight back.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => (
          <ActionForm key={option.value} action={setRolePreview} quiet>
            <input type="hidden" name="role" value={option.value} />
            <SubmitButton variant={current === (option.value === 'employee' ? 'employee' : option.value) ? 'primary' : 'secondary'} title={option.detail}>
              {option.label}
            </SubmitButton>
          </ActionForm>
        ))}
        {current ? (
          <ActionForm action={setRolePreview} quiet>
            <input type="hidden" name="role" value="off" />
            <SubmitButton variant="quiet">Stop previewing</SubmitButton>
          </ActionForm>
        ) : null}
      </div>
    </section>
  );
}
