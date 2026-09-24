'use client';

import type { ChecklistTemplate, Contractor, ContractorBooking, EmployeeSummary, Incident, LocationSummary, Position, RequirementType, StaffAnnouncement, StaffingRole, TrainingModuleSummary } from '@/content/staff-types';
import { CONTRACTOR_SERVICE_LABEL, INCIDENT_CATEGORY_LABEL, STAFFING_ROLE_LABEL, STAFFING_ROLE_ORDER } from '@/content/staff-types';
import { saveAnnouncementAction } from '@/server/actions/staff/announcements';
import { saveChecklistTemplate, startChecklist } from '@/server/actions/staff/checklists';
import { saveBookingAction, saveContractorAction } from '@/server/actions/staff/contractors';
import { saveIncidentAction } from '@/server/actions/staff/incidents';
import { addManagerNote } from '@/server/actions/staff/notes';
import { saveRequirementTypeAction, verifyDocument } from '@/server/actions/staff/requirements';
import { assignEmployeeToEvent } from '@/server/actions/staff/staffing';
import { saveLocationAction, changeAccess } from '@/server/actions/staff/team';
import { assignTraining } from '@/server/actions/staff/training';
import { ActionForm, CheckGroup, Checkbox, Field, IntentField, Select, SubmitButton, TextArea, TextInput } from '@/components/staff/forms';
import type { EventOption } from './ShiftForm';

/* The smaller manager forms, in one file so a screen imports one thing. */

export function TemplateForm({ template, locations, positions }: { template: ChecklistTemplate | null; locations: LocationSummary[]; positions: Position[] }) {
  return (
    <ActionForm action={saveChecklistTemplate} className="grid gap-4 sm:grid-cols-2">
      {template ? <input type="hidden" name="id" value={template.id} /> : null}
      <div className="sm:col-span-2">
        <Field id="title" label="Checklist">
          <TextInput id="title" name="title" defaultValue={template?.title ?? ''} required maxLength={120} placeholder="Closing checklist" />
        </Field>
      </div>
      <Field id="kind" label="Kind">
        <Select id="kind" name="kind" defaultValue={template?.kind ?? 'other'}>
          {['opening', 'closing', 'bar', 'event', 'door', 'kitchen', 'cleaning', 'other'].map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="positionId" label="For a position" hint="Optional.">
        <Select id="positionId" name="positionId" defaultValue={template?.positionId ?? ''}>
          <option value="">Anyone</option>
          {positions.map((position) => (
            <option key={position.id} value={position.id}>
              {position.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="locationId" label="Location">
        <Select id="locationId" name="locationId" defaultValue={template?.locationId ?? ''}>
          <option value="">Every location</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Field id="items" label="Lines, one per row" hint="Add [photo] to a line to require a photo, [note] to require a note.">
          <TextArea id="items" name="items" rows={8} required defaultValue={template?.items.map((item) => `${item.label}${item.requiresPhoto ? ' [photo]' : ''}${item.requiresNote ? ' [note]' : ''}`).join('\n') ?? ''} />
        </Field>
      </div>
      {template ? (
        <Checkbox id="archived" name="archived" defaultChecked={!template.active}>
          Archived — hidden from the start list
        </Checkbox>
      ) : null}
      <div className="sm:col-span-2">
        <SubmitButton>{template ? 'Save checklist' : 'Create checklist'}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function StartRunForm({ templates, employees, events, date, locationId }: { templates: ChecklistTemplate[]; employees: EmployeeSummary[]; events: EventOption[]; date: string; locationId: string }) {
  return (
    <ActionForm action={startChecklist} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="locationId" value={locationId} />
      <Field id="templateId" label="Checklist">
        <Select id="templateId" name="templateId" required>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.title}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="onDate" label="Date">
        <TextInput id="onDate" name="onDate" type="date" defaultValue={date} />
      </Field>
      <Field id="assignedEmployeeId" label="Assign to" hint="Optional.">
        <Select id="assignedEmployeeId" name="assignedEmployeeId" defaultValue="">
          <option value="">Anyone on shift</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.displayName}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="eventId" label="Event" hint="Optional.">
        <Select id="eventId" name="eventId" defaultValue="">
          <option value="">None</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.label}
            </option>
          ))}
        </Select>
      </Field>
      <div className="sm:col-span-4">
        <SubmitButton variant="secondary">Start checklist</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ContractorForm({ contractor }: { contractor: Contractor | null }) {
  return (
    <ActionForm action={saveContractorAction} className="grid gap-4 sm:grid-cols-2">
      {contractor ? <input type="hidden" name="id" value={contractor.id} /> : null}
      <Field id="name" label="Name">
        <TextInput id="name" name="name" defaultValue={contractor?.name ?? ''} required maxLength={100} />
      </Field>
      <Field id="companyName" label="Company / stage name">
        <TextInput id="companyName" name="companyName" defaultValue={contractor?.companyName ?? ''} maxLength={100} />
      </Field>
      <Field id="serviceType" label="Service">
        <Select id="serviceType" name="serviceType" defaultValue={contractor?.serviceType ?? 'dj'}>
          {(Object.keys(CONTRACTOR_SERVICE_LABEL) as (keyof typeof CONTRACTOR_SERVICE_LABEL)[]).map((service) => (
            <option key={service} value={service}>
              {CONTRACTOR_SERVICE_LABEL[service]}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="defaultRate" label="Usual rate ($)">
        <TextInput id="defaultRate" name="defaultRate" inputMode="decimal" defaultValue={contractor?.defaultRateCents != null ? (contractor.defaultRateCents / 100).toFixed(2) : ''} />
      </Field>
      <Field id="phone" label="Phone">
        <TextInput id="phone" name="phone" type="tel" defaultValue={contractor?.phone ?? ''} />
      </Field>
      <Field id="email" label="Email">
        <TextInput id="email" name="email" type="email" defaultValue={contractor?.email ?? ''} />
      </Field>
      <Field id="paymentMethodNote" label="How they get paid" hint="Zelle, check, cash…">
        <TextInput id="paymentMethodNote" name="paymentMethodNote" defaultValue={contractor?.paymentMethodNote ?? ''} maxLength={120} />
      </Field>
      <Field id="w9Status" label="W-9">
        <Select id="w9Status" name="w9Status" defaultValue={contractor?.w9Status ?? 'missing'}>
          <option value="missing">Missing</option>
          <option value="requested">Requested</option>
          <option value="received">Received</option>
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Field id="notes" label="Notes">
          <TextArea id="notes" name="notes" rows={3} defaultValue={contractor?.notes ?? ''} maxLength={2000} />
        </Field>
      </div>
      {contractor ? (
        <Checkbox id="archived" name="archived" defaultChecked={!contractor.active}>
          No longer used
        </Checkbox>
      ) : null}
      <div className="sm:col-span-2">
        <SubmitButton>{contractor ? 'Save' : 'Add contractor'}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function BookingForm({ booking, contractors, events, defaultContractorId, defaultEventId }: { booking: ContractorBooking | null; contractors: Contractor[]; events: EventOption[]; defaultContractorId?: string | null; defaultEventId?: string | null }) {
  const dollars = (cents: number | undefined) => (cents ? (cents / 100).toFixed(2) : '');
  return (
    <ActionForm action={saveBookingAction} className="grid gap-4 sm:grid-cols-2">
      {booking ? <input type="hidden" name="id" value={booking.id} /> : null}
      <Field id="contractorId" label="Contractor">
        <Select id="contractorId" name="contractorId" defaultValue={booking?.contractorId ?? defaultContractorId ?? ''} required>
          <option value="">Pick…</option>
          {contractors.map((contractor) => (
            <option key={contractor.id} value={contractor.id}>
              {contractor.name} · {CONTRACTOR_SERVICE_LABEL[contractor.serviceType]}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="eventId" label="Event">
        <Select id="eventId" name="eventId" defaultValue={booking?.eventId ?? defaultEventId ?? ''}>
          <option value="">Not tied to an event</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="role" label="Role that night">
        <Select id="role" name="role" defaultValue={booking?.role ?? 'dj'}>
          {(Object.keys(CONTRACTOR_SERVICE_LABEL) as (keyof typeof CONTRACTOR_SERVICE_LABEL)[]).map((service) => (
            <option key={service} value={service}>
              {CONTRACTOR_SERVICE_LABEL[service]}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="status" label="Status">
        <Select id="status" name="status" defaultValue={booking?.status ?? 'tentative'}>
          <option value="tentative">Tentative</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </Field>
      <Field id="agreed" label="Agreed ($)">
        <TextInput id="agreed" name="agreed" inputMode="decimal" defaultValue={dollars(booking?.agreedCents)} />
      </Field>
      <Field id="deposit" label="Deposit ($)">
        <TextInput id="deposit" name="deposit" inputMode="decimal" defaultValue={dollars(booking?.depositCents)} />
      </Field>
      <Field id="paid" label="Paid so far ($)">
        <TextInput id="paid" name="paid" inputMode="decimal" defaultValue={dollars(booking?.paidCents)} />
      </Field>
      <Field id="paidOn" label="Paid on">
        <TextInput id="paidOn" name="paidOn" type="date" defaultValue={booking?.paidOn ?? ''} />
      </Field>
      <Field id="paymentNote" label="Payment note">
        <TextInput id="paymentNote" name="paymentNote" defaultValue={booking?.paymentNote ?? ''} maxLength={200} />
      </Field>
      <Field id="arrivalNote" label="Arrival instructions" hint="The contractor reads this: which door, where to park, who to ask for.">
        <TextInput id="arrivalNote" name="arrivalNote" defaultValue={booking?.arrivalNote ?? ''} maxLength={300} />
      </Field>
      <Field id="note" label="Internal note" hint="Managers only. The contractor never sees this.">
        <TextInput id="note" name="note" defaultValue={booking?.note ?? ''} maxLength={300} />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton>{booking ? 'Save booking' : 'Book'}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function AssignToEventForm({ eventId, employees }: { eventId: string; employees: EmployeeSummary[] }) {
  return (
    <ActionForm action={assignEmployeeToEvent} className="grid gap-3 sm:grid-cols-[1fr_1fr_7rem_7rem_auto] sm:items-end">
      <input type="hidden" name="eventId" value={eventId} />
      <Field id="assign-employee" label="Who">
        <Select id="assign-employee" name="employeeId" required>
          <option value="">Pick…</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.displayName} · {employee.positionIds.join(', ')}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="assign-role" label="Role">
        <Select id="assign-role" name="role" defaultValue="bartender">
          {STAFFING_ROLE_ORDER.map((role: StaffingRole) => (
            <option key={role} value={role}>
              {STAFFING_ROLE_LABEL[role]}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="assign-start" label="Start" hint="Blank = event">
        <TextInput id="assign-start" name="startTime" type="time" />
      </Field>
      <Field id="assign-end" label="End">
        <TextInput id="assign-end" name="endTime" type="time" />
      </Field>
      <SubmitButton variant="secondary">Assign</SubmitButton>
      <div className="sm:col-span-5">
        <Field id="assign-note" label="Note for them" hint="Optional.">
          <TextInput id="assign-note" name="note" maxLength={300} />
        </Field>
      </div>
    </ActionForm>
  );
}

export function AnnouncementForm({ announcement, locations, positions, events }: { announcement: StaffAnnouncement | null; locations: LocationSummary[]; positions: Position[]; events: EventOption[] }) {
  return (
    <ActionForm action={saveAnnouncementAction} className="grid gap-4 sm:grid-cols-2">
      {announcement ? <input type="hidden" name="id" value={announcement.id} /> : null}
      <IntentField name="intent" initial="publish" />
      <div className="sm:col-span-2">
        <Field id="title" label="Title">
          <TextInput id="title" name="title" defaultValue={announcement?.title ?? ''} required maxLength={120} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field id="body" label="Announcement">
          <TextArea id="body" name="body" rows={5} defaultValue={announcement?.body ?? ''} required maxLength={4000} />
        </Field>
      </div>
      <Field id="kind" label="Kind">
        <Select id="kind" name="kind" defaultValue={announcement?.kind ?? 'general'}>
          <option value="general">General</option>
          <option value="urgent">Urgent</option>
        </Select>
      </Field>
      <Field id="locationId" label="Location">
        <Select id="locationId" name="locationId" defaultValue={announcement?.locationId ?? ''}>
          <option value="">Everyone, everywhere</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <p className="mb-1 text-[0.875rem] font-semibold text-brown">Only these positions</p>
        <p className="mb-1 text-[0.8125rem] text-brown-soft">Nothing ticked = everyone.</p>
        <CheckGroup name="positions" options={positions.map((position) => ({ id: position.id, label: position.name }))} selected={announcement?.positions ?? []} />
      </div>
      <Field id="eventId" label="About an event" hint="Optional.">
        <Select id="eventId" name="eventId" defaultValue={announcement?.eventId ?? ''}>
          <option value="">None</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="expiresAt" label="Take down on" hint="Optional.">
        <TextInput id="expiresAt" name="expiresAt" type="date" defaultValue={announcement?.expiresAt?.slice(0, 10) ?? ''} />
      </Field>
      <div className="sm:col-span-2">
        <Checkbox id="requiresAck" name="requiresAck" defaultChecked={announcement?.requiresAck ?? false}>
          Ask everyone to acknowledge (“I have read this”) and show me who has
        </Checkbox>
      </div>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <SubmitButton name="intent" value="publish">
          {announcement ? 'Save' : 'Post now'}
        </SubmitButton>
        <SubmitButton variant="secondary" name="intent" value="draft">
          Save as draft
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

/**
 * One form, two audiences.
 *
 * `review` is off for an employee reporting something: the fields a manager
 * owns — location, event, who else was involved, what was done about it,
 * follow-up state — are not rendered, and the action ignores them even if
 * they arrive anyway.
 */
export function IncidentForm({ incident, employees, locations, events, defaultLocationId, review = true }: { incident: Incident | null; employees: EmployeeSummary[]; locations: LocationSummary[]; events: EventOption[]; defaultLocationId: string; review?: boolean }) {
  return (
    <ActionForm action={saveIncidentAction} className="grid gap-4 sm:grid-cols-2">
      {incident && review ? <input type="hidden" name="id" value={incident.id} /> : null}
      <div className="sm:col-span-2">
        <Field id="summary" label="What happened, in one line">
          <TextInput id="summary" name="summary" defaultValue={incident?.summary ?? ''} required maxLength={200} />
        </Field>
      </div>
      <Field id="category" label="Category">
        <Select id="category" name="category" defaultValue={incident?.category ?? 'guest'}>
          {(Object.keys(INCIDENT_CATEGORY_LABEL) as (keyof typeof INCIDENT_CATEGORY_LABEL)[]).map((category) => (
            <option key={category} value={category}>
              {INCIDENT_CATEGORY_LABEL[category]}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="occurredAt" label="When">
        <TextInput id="occurredAt" name="occurredAt" type="datetime-local" defaultValue={incident ? new Date(incident.occurredAt).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)} />
      </Field>
      {review ? (
        <>
          <Field id="locationId" label="Location">
            <Select id="locationId" name="locationId" defaultValue={incident?.locationId ?? defaultLocationId}>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="eventId" label="Event" hint="Optional.">
            <Select id="eventId" name="eventId" defaultValue={incident?.eventId ?? ''}>
              <option value="">None</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.label}
                </option>
              ))}
            </Select>
          </Field>
        </>
      ) : null}
      <div className="sm:col-span-2">
        <Field id="description" label={review ? 'Details' : 'What happened'} hint={review ? undefined : 'As much as you remember, in order. A manager reads this — not your coworkers.'}>
          <TextArea id="description" name="description" rows={5} defaultValue={incident?.description ?? ''} maxLength={8000} />
        </Field>
      </div>
      {review ? (
        <>
          <div className="sm:col-span-2">
            <Field id="actionsTaken" label="Actions taken">
              <TextArea id="actionsTaken" name="actionsTaken" rows={3} defaultValue={incident?.actionsTaken ?? ''} maxLength={4000} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <p className="mb-1 text-[0.875rem] font-semibold text-brown">Employees involved</p>
            <CheckGroup name="employeeIds" options={employees.map((employee) => ({ id: employee.id, label: employee.displayName }))} selected={incident?.employees.map((entry) => entry.employeeId) ?? []} />
          </div>
          <Field id="followUpStatus" label="Follow-up">
            <Select id="followUpStatus" name="followUpStatus" defaultValue={incident?.followUpStatus ?? 'open'}>
              <option value="open">Open</option>
              <option value="monitoring">Monitoring</option>
              <option value="closed">Closed</option>
            </Select>
          </Field>
        </>
      ) : null}
      <Field id="attachments" label="Attachments" hint="Photos or PDFs. Stored privately.">
        <input id="attachments" name="attachments" type="file" multiple accept="image/*,application/pdf" className="mt-1.5 block w-full text-[0.9375rem] text-brown file:mr-3 file:rounded-(--radius-sm) file:border file:border-brown/30 file:bg-transparent file:px-3 file:py-2 file:text-brown" />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton>{!review ? 'Send to a manager' : incident ? 'Save incident' : 'Record incident'}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function NoteForm({ employeeId }: { employeeId: string }) {
  return (
    <ActionForm action={addManagerNote} className="grid gap-3">
      <input type="hidden" name="employeeId" value={employeeId} />
      <Field id="note-kind" label="Kind">
        <Select id="note-kind" name="kind" defaultValue="other">
          <option value="coaching">Coaching</option>
          <option value="attendance">Attendance</option>
          <option value="recognition">Recognition</option>
          <option value="follow_up">Follow-up</option>
          <option value="other">Other</option>
        </Select>
      </Field>
      <Field id="note-body" label="Note" hint="Only managers and the owner can ever see this.">
        <TextArea id="note-body" name="body" rows={3} required maxLength={4000} />
      </Field>
      <div>
        <SubmitButton variant="secondary">Add note</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function VerifyForm({ employeeId, typeId, expiresOn }: { employeeId: string; typeId: string; expiresOn: string | null }) {
  return (
    <ActionForm action={verifyDocument} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="typeId" value={typeId} />
      <Field id={`verify-${typeId}-status`} label="Decision">
        <Select id={`verify-${typeId}-status`} name="status" defaultValue="complete">
          <option value="complete">Verified — complete</option>
          <option value="waived">Waived for this person</option>
          <option value="missing">Send back</option>
        </Select>
      </Field>
      <Field id={`verify-${typeId}-expires`} label="Expires on">
        <TextInput id={`verify-${typeId}-expires`} name="expiresOn" type="date" defaultValue={expiresOn ?? ''} />
      </Field>
      <SubmitButton variant="secondary">Save</SubmitButton>
      <div className="sm:col-span-3">
        <TextInput name="note" placeholder="Note to the employee (optional)" maxLength={300} />
      </div>
    </ActionForm>
  );
}

export function AssignTrainingForm({ moduleId, employees }: { moduleId: string; employees: EmployeeSummary[] }) {
  return (
    <ActionForm action={assignTraining} className="grid gap-3">
      <input type="hidden" name="moduleId" value={moduleId} />
      <CheckGroup name="employeeIds" options={employees.map((employee) => ({ id: employee.id, label: `${employee.displayName} · ${employee.positionIds.join(', ')}` }))} selected={[]} />
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field id="dueOn" label="Due" hint="Optional.">
          <TextInput id="dueOn" name="dueOn" type="date" />
        </Field>
        <Checkbox id="everyone" name="everyone">
          Everyone it applies to
        </Checkbox>
      </div>
      <div>
        <SubmitButton variant="secondary">Assign</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function RequirementTypeForm({ type, positions, locations, modules }: { type: RequirementType | null; positions: Position[]; locations: LocationSummary[]; modules: TrainingModuleSummary[] }) {
  return (
    <ActionForm action={saveRequirementTypeAction} className="grid gap-4 sm:grid-cols-2">
      {type ? <input type="hidden" name="id" value={type.id} /> : null}
      <div className="sm:col-span-2">
        <Field id="rt-title" label="Title">
          <TextInput id="rt-title" name="title" defaultValue={type?.title ?? ''} required maxLength={120} placeholder="Employee handbook" />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field id="rt-description" label="What it is, in a sentence">
          <TextInput id="rt-description" name="description" defaultValue={type?.description ?? ''} maxLength={300} />
        </Field>
      </div>
      <Field id="rt-category" label="Category">
        <Select id="rt-category" name="category" defaultValue={type?.category ?? 'policy'}>
          {['employment', 'policy', 'handbook', 'certification', 'safety', 'uniform', 'confidentiality', 'payroll', 'training', 'other'].map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="rt-kind" label="How it is completed">
        <Select id="rt-kind" name="kind" defaultValue={type?.kind ?? 'acknowledgement'}>
          <option value="acknowledgement">Employee acknowledges (“I have read this”)</option>
          <option value="upload">Employee uploads a file</option>
          <option value="link">Employee completes it on an outside site</option>
          <option value="manager_verify">A manager verifies it</option>
          <option value="training_module">Completing a training module</option>
        </Select>
      </Field>
      <Field id="rt-url" label="Link" hint="The policy text, the form, the outside site.">
        <TextInput id="rt-url" name="externalUrl" type="url" defaultValue={type?.externalUrl ?? ''} />
      </Field>
      <Field id="rt-module" label="Training module" hint="For the training kind.">
        <Select id="rt-module" name="trainingModuleId" defaultValue={type?.trainingModuleId ?? ''}>
          <option value="">—</option>
          {modules.map((module) => (
            <option key={module.id} value={module.id}>
              {module.title}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="rt-expires" label="Expires after (days)" hint="Blank = never.">
        <TextInput id="rt-expires" name="expiresAfterDays" type="number" min={1} inputMode="numeric" defaultValue={type?.expiresAfterDays ?? ''} />
      </Field>
      <div className="grid gap-2">
        <Checkbox id="rt-required" name="required" defaultChecked={type?.required ?? true}>
          Required
        </Checkbox>
        <Checkbox id="rt-onboarding" name="onboarding" defaultChecked={type?.onboarding ?? true}>
          Part of onboarding
        </Checkbox>
        {type ? (
          <Checkbox id="rt-archived" name="archived" defaultChecked={!type.active}>
            Retired
          </Checkbox>
        ) : null}
      </div>
      <div className="sm:col-span-2">
        <p className="mb-1 text-[0.875rem] font-semibold text-brown">Applies to positions</p>
        <p className="mb-1 text-[0.8125rem] text-brown-soft">Nothing ticked = everyone.</p>
        <CheckGroup name="positions" options={positions.map((position) => ({ id: position.id, label: position.name }))} selected={type?.appliesToPositions ?? []} />
      </div>
      {locations.length > 1 ? (
        <div className="sm:col-span-2">
          <p className="mb-1 text-[0.875rem] font-semibold text-brown">Applies to locations</p>
          <CheckGroup name="locations" options={locations.map((location) => ({ id: location.id, label: location.name }))} selected={type?.appliesToLocations ?? []} />
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <SubmitButton>{type ? 'Save' : 'Add requirement'}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function AccessForm({ employeeId, current }: { employeeId: string; current: string | null }) {
  return (
    <ActionForm action={changeAccess} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="employeeId" value={employeeId} />
      <Field id="access-role" label="Account tier">
        <Select id="access-role" name="role" defaultValue={current === 'owner' || current === 'admin' ? current : 'staff'}>
          <option value="staff">Employee — staff app only</option>
          <option value="admin">Manager — staff app plus the admin</option>
          <option value="owner">Owner</option>
        </Select>
      </Field>
      <SubmitButton variant="secondary">Change access</SubmitButton>
    </ActionForm>
  );
}

export function LocationForm({ location }: { location: { id: string; slug: string; name: string; shortName: string; timezone: string; active: boolean } | null }) {
  return (
    <ActionForm action={saveLocationAction} className="grid gap-3 sm:grid-cols-2">
      {location ? <input type="hidden" name="id" value={location.id} /> : null}
      <Field id="loc-name" label="Name">
        <TextInput id="loc-name" name="name" defaultValue={location?.name ?? ''} required placeholder="Casa Aurelia River North" />
      </Field>
      <Field id="loc-short" label="Short name">
        <TextInput id="loc-short" name="shortName" defaultValue={location?.shortName ?? ''} placeholder="River North" />
      </Field>
      <Field id="loc-street" label="Street">
        <TextInput id="loc-street" name="street" />
      </Field>
      <Field id="loc-locality" label="City">
        <TextInput id="loc-locality" name="locality" />
      </Field>
      <Field id="loc-region" label="State">
        <TextInput id="loc-region" name="region" defaultValue="IL" />
      </Field>
      <Field id="loc-postal" label="ZIP">
        <TextInput id="loc-postal" name="postalCode" />
      </Field>
      <Field id="loc-tz" label="Time zone">
        <TextInput id="loc-tz" name="timezone" defaultValue={location?.timezone ?? 'America/Chicago'} />
      </Field>
      <Field id="loc-phone" label="Phone">
        <TextInput id="loc-phone" name="phone" type="tel" />
      </Field>
      {location ? (
        <Checkbox id="loc-inactive" name="inactive" defaultChecked={!location.active}>
          Not operating
        </Checkbox>
      ) : null}
      <div className="sm:col-span-2">
        <SubmitButton>{location ? 'Save location' : 'Add location'}</SubmitButton>
      </div>
    </ActionForm>
  );
}
