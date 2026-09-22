'use client';

import type { EmployeeDetail, EmployeeSummary, LocationSummary, Position } from '@/content/staff-types';
import { EMPLOYEE_STATUS_LABEL, EMPLOYMENT_TYPE_LABEL } from '@/content/staff-types';
import { addEmployee, saveEmployee } from '@/server/actions/staff/team';
import { ActionForm, CheckGroup, Checkbox, Field, Fieldset, Select, SubmitButton, TextInput } from '@/components/staff/forms';

/** The management side of a person: who they are, what they work, where, and their status. */
export function EmployeeForm({ employee, positions, locations, managers, defaultLocationId }: { employee: EmployeeDetail | null; positions: Position[]; locations: LocationSummary[]; managers: EmployeeSummary[]; defaultLocationId: string }) {
  return (
    <ActionForm action={employee ? saveEmployee : addEmployee} className="grid gap-4 sm:grid-cols-2">
      {(state) => (
        <>
          {employee ? <input type="hidden" name="id" value={employee.id} /> : null}
          <Field id="firstName" label="First name">
            <TextInput id="firstName" name="firstName" defaultValue={employee?.firstName ?? ''} required autoFocus={!employee} maxLength={60} />
          </Field>
          <Field id="lastName" label="Last name">
            <TextInput id="lastName" name="lastName" defaultValue={employee?.lastName ?? ''} maxLength={60} />
          </Field>
          <Field id="email" label="Email" hint="How they sign in." error={state.errors?.email}>
            <TextInput id="email" name="email" type="email" defaultValue={employee?.email ?? ''} required />
          </Field>
          <Field id="phone" label="Phone">
            <TextInput id="phone" name="phone" type="tel" defaultValue={employee?.phone ?? ''} />
          </Field>
          <Fieldset legend="Work">
            <div className="sm:col-span-2">
              <p className="mb-1 text-[0.875rem] font-semibold text-brown">Positions</p>
              <CheckGroup name="positions" options={positions.map((position) => ({ id: position.id, label: position.name }))} selected={employee?.positionIds ?? []} />
            </div>
            <Field id="primaryPositionId" label="Main position">
              <Select id="primaryPositionId" name="primaryPositionId" defaultValue={employee?.primaryPositionId ?? ''}>
                <option value="">First ticked</option>
                {positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="employmentType" label="Employment">
              <Select id="employmentType" name="employmentType" defaultValue={employee?.employmentType ?? 'part_time'}>
                {(Object.keys(EMPLOYMENT_TYPE_LABEL) as (keyof typeof EMPLOYMENT_TYPE_LABEL)[]).map((type) => (
                  <option key={type} value={type}>
                    {EMPLOYMENT_TYPE_LABEL[type]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="primaryLocationId" label="Home location">
              <Select id="primaryLocationId" name="primaryLocationId" defaultValue={employee?.primaryLocationId ?? defaultLocationId}>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </Select>
            </Field>
            {locations.length > 1 ? (
              <div>
                <p className="mb-1 text-[0.875rem] font-semibold text-brown">Also works at</p>
                <CheckGroup name="locations" options={locations.map((location) => ({ id: location.id, label: location.name }))} selected={employee?.locationIds ?? [defaultLocationId]} />
              </div>
            ) : null}
            <Field id="managerEmployeeId" label="Reports to">
              <Select id="managerEmployeeId" name="managerEmployeeId" defaultValue={employee?.managerEmployeeId ?? ''}>
                <option value="">—</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.displayName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="status" label="Status">
              <Select id="status" name="status" defaultValue={employee?.status ?? 'invited'}>
                {(Object.keys(EMPLOYEE_STATUS_LABEL) as (keyof typeof EMPLOYEE_STATUS_LABEL)[]).map((status) => (
                  <option key={status} value={status}>
                    {EMPLOYEE_STATUS_LABEL[status]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="hireDate" label="Hire date">
              <TextInput id="hireDate" name="hireDate" type="date" defaultValue={employee?.hireDate ?? ''} />
            </Field>
            <Field id="startDate" label="First day">
              <TextInput id="startDate" name="startDate" type="date" defaultValue={employee?.startDate ?? ''} />
            </Field>
          </Fieldset>
          {!employee ? (
            <div className="sm:col-span-2">
              <Checkbox id="invite" name="invite" defaultChecked>
                Create their sign-in and email the invitation now
              </Checkbox>
              <p className="text-[0.8125rem] text-brown-soft">They get a welcome email with a link into onboarding. Their required training is assigned automatically.</p>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <SubmitButton>{employee ? 'Save' : 'Add to the team'}</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
