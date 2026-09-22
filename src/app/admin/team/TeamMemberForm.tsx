'use client';

import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { Checkbox, Label, Select } from '@/components/admin/ui';
import { saveTeamMember } from '@/server/actions/team';
import { ADMIN_ROLES, ROLE_LABEL, type Role } from '@/server/permissions';

export function TeamMemberForm({
  member,
  sections,
  isSelf,
}: {
  member: { userId: string; name: string; role: Role; active: boolean; sections: string[] };
  sections: string[];
  isSelf: boolean;
}) {
  return (
    <ActionForm
      action={saveTeamMember}
      className="rounded-(--radius-md) border border-brown/15 bg-ivory p-4"
    >
      <input type="hidden" name="userId" value={member.userId} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.9375rem] font-semibold text-brown">
          {member.name || member.userId}
          {isSelf ? <span className="ml-2 text-[0.8125rem] font-normal text-brown-soft">(you)</span> : null}
        </p>
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`role-${member.userId}`}>Role</Label>
          <Select id={`role-${member.userId}`} name="role" defaultValue={member.role}>
            {(ADMIN_ROLES.includes(member.role) ? ADMIN_ROLES : [...ADMIN_ROLES, member.role]).map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-end">
          <Checkbox id={`active-${member.userId}`} name="active" defaultChecked={member.active}>
            Can sign in
          </Checkbox>
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className="text-[0.875rem] font-semibold text-brown">
          Limit a Contributor to certain sections
        </legend>
        <p className="mt-0.5 text-[0.8125rem] text-brown-soft">
          Leave all unticked for no limit. This has no effect on a Manager or an Owner.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4">
          {sections.map((section) => (
            <label
              key={section}
              className="flex min-h-11 items-center gap-2 text-[0.9375rem] capitalize text-brown"
            >
              <input
                type="checkbox"
                name="sections"
                value={section}
                defaultChecked={member.sections.includes(section)}
                className="size-4 accent-[var(--color-coral)]"
              />
              {section}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4">
        <SubmitButton variant="secondary">Save account</SubmitButton>
      </div>
    </ActionForm>
  );
}
