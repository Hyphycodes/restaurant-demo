'use client';

import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { setRolePreview } from '@/server/actions/staff/preview';

/**
 * Says, loudly, that what is on screen is not what this account can do.
 *
 * Loud on purpose: the failure mode of a preview tool is forgetting it is
 * on and then filing a bug about a missing button.
 */
export function PreviewBanner({ role }: { role: string }) {
  return (
    <div className="sticky top-[3.25rem] z-30 border-b border-amber/40 bg-amber/15 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:px-6">
        <p className="text-[0.875rem] font-semibold text-amber">
          Previewing as {role}.
          <span className="ml-1.5 font-normal text-brown-soft">This is what they see — your own access is unchanged.</span>
        </p>
        <span className="ml-auto">
          <ActionForm action={setRolePreview} quiet>
            <input type="hidden" name="role" value="off" />
            <SubmitButton variant="secondary">Exit preview</SubmitButton>
          </ActionForm>
        </span>
      </div>
    </div>
  );
}
