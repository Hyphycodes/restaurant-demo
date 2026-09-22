'use client';

import type { EmployeeSummary, LocationSummary, Task } from '@/content/staff-types';
import { saveTask } from '@/server/actions/staff/tasks';
import { ActionForm, Field, Select, SubmitButton, TextArea, TextInput } from '@/components/staff/forms';
import type { EventOption } from './ShiftForm';

export function TaskForm({ task, employees, locations, events, defaultLocationId, defaultEventId, defaultEmployeeId }: { task: Task | null; employees: EmployeeSummary[]; locations: LocationSummary[]; events: EventOption[]; defaultLocationId: string; defaultEventId?: string | null; defaultEmployeeId?: string | null }) {
  const due = task?.dueAt ? new Date(task.dueAt) : null;
  return (
    <ActionForm action={saveTask} className="grid gap-4 sm:grid-cols-2">
      {task ? <input type="hidden" name="id" value={task.id} /> : null}
      <div className="sm:col-span-2">
        <Field id="title" label="Task">
          <TextInput id="title" name="title" defaultValue={task?.title ?? ''} maxLength={140} required autoFocus placeholder="Print Vinyl & Vermouth QR sign" />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field id="description" label="Details" hint="Optional.">
          <TextArea id="description" name="description" rows={3} maxLength={2000} defaultValue={task?.description ?? ''} />
        </Field>
      </div>
      <Field id="assignedTo" label="Assign to">
        <Select id="assignedTo" name="assignedTo" defaultValue={task?.assignedTo ?? defaultEmployeeId ?? ''}>
          <option value="">Nobody yet</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.displayName}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="priority" label="Priority">
        <Select id="priority" name="priority" defaultValue={task?.priority ?? 'normal'}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </Select>
      </Field>
      <Field id="dueDate" label="Due date" hint="Optional.">
        <TextInput id="dueDate" name="dueDate" type="date" defaultValue={due ? due.toISOString().slice(0, 10) : ''} />
      </Field>
      <Field id="dueTime" label="Due time">
        <TextInput id="dueTime" name="dueTime" type="time" defaultValue="17:00" />
      </Field>
      <Field id="eventId" label="Related event">
        <Select id="eventId" name="eventId" defaultValue={task?.eventId ?? defaultEventId ?? ''}>
          <option value="">None</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="locationId" label="Location">
        <Select id="locationId" name="locationId" defaultValue={task?.locationId ?? defaultLocationId}>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton>{task ? 'Save task' : 'Add task'}</SubmitButton>
      </div>
    </ActionForm>
  );
}
