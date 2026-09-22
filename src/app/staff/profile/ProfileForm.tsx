'use client';

import type { EmployeeDetail } from '@/content/staff-types';
import { saveOwnProfile, uploadOwnPhoto } from '@/server/actions/staff/profile';
import { ActionForm, Checkbox, Field, Fieldset, Select, SubmitButton, TextInput } from '@/components/staff/forms';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

export function ProfileForm({ employee }: { employee: EmployeeDetail }) {
  return (
    <div className="grid gap-6">
      <ActionForm action={uploadOwnPhoto} className="flex flex-wrap items-end gap-3">
        <Field id="photo" label="Profile photo" hint="JPG or PNG. Managers see it in the directory.">
          <input id="photo" name="photo" type="file" accept="image/*" className="mt-1.5 block w-full text-[0.9375rem] text-brown file:mr-3 file:rounded-(--radius-sm) file:border file:border-brown/30 file:bg-transparent file:px-3 file:py-2 file:text-brown" />
        </Field>
        <SubmitButton variant="secondary">Upload</SubmitButton>
      </ActionForm>

      <ActionForm action={saveOwnProfile} className="grid gap-4">
        {(state) => (
          <>
            <Field id="preferredName" label="What should we call you?" hint={`Your name on file is ${employee.fullName}.`}>
              <TextInput id="preferredName" name="preferredName" defaultValue={employee.preferredName ?? ''} maxLength={60} />
            </Field>
            <Field id="phone" label="Phone" error={state.errors?.phone}>
              <TextInput id="phone" name="phone" type="tel" defaultValue={employee.phone ?? ''} autoComplete="tel" />
            </Field>
            <Field id="preferredLanguage" label="Preferred language">
              <Select id="preferredLanguage" name="preferredLanguage" defaultValue={employee.preferredLanguage}>
                <option value="en">English</option>
                <option value="es">Español</option>
              </Select>
            </Field>
            <Fieldset legend="Emergency contact">
              <Field id="emergencyContactName" label="Name">
                <TextInput id="emergencyContactName" name="emergencyContactName" defaultValue={employee.emergencyContactName ?? ''} />
              </Field>
              <Field id="emergencyContactPhone" label="Phone">
                <TextInput id="emergencyContactPhone" name="emergencyContactPhone" type="tel" defaultValue={employee.emergencyContactPhone ?? ''} />
              </Field>
              <Field id="emergencyContactRelationship" label="Relationship">
                <TextInput id="emergencyContactRelationship" name="emergencyContactRelationship" defaultValue={employee.emergencyContactRelationship ?? ''} placeholder="Mother, partner, roommate…" />
              </Field>
            </Fieldset>
            <Fieldset legend="Uniform and birthday">
              <Field id="shirtSize" label="Shirt size">
                <Select id="shirtSize" name="shirtSize" defaultValue={employee.shirtSize ?? ''}>
                  <option value="">Pick one…</option>
                  {SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field id="birthdayMonth" label="Birthday month" hint="Optional.">
                  <TextInput id="birthdayMonth" name="birthdayMonth" type="number" min={1} max={12} inputMode="numeric" defaultValue={employee.birthdayMonth ?? ''} />
                </Field>
                <Field id="birthdayDay" label="Day">
                  <TextInput id="birthdayDay" name="birthdayDay" type="number" min={1} max={31} inputMode="numeric" defaultValue={employee.birthdayDay ?? ''} />
                </Field>
              </div>
            </Fieldset>
            <Fieldset legend="Notifications">
              <Checkbox id="notificationEmail" name="notificationEmail" defaultChecked={employee.notificationEmail}>
                Email me when my schedule is published, a shift changes, or something needs me
              </Checkbox>
              <p className="text-[0.8125rem] text-brown-soft">Small things stay in the app. You always get in-app notifications.</p>
            </Fieldset>
            <div>
              <SubmitButton>Save profile</SubmitButton>
            </div>
          </>
        )}
      </ActionForm>
    </div>
  );
}
