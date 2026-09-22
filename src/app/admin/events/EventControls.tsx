'use client';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { Label, TextInput, Select } from '@/components/admin/ui';
import { duplicateEvent, archiveOccurrence, createSeries } from '@/server/actions/events';

export function EventControls({ id, canPublish }: { id: string; canPublish: boolean }) {
  return <div className="flex flex-wrap gap-3">
    <ActionForm action={duplicateEvent}><input type="hidden" name="id" value={id} /><SubmitButton variant="secondary">Duplicate as draft</SubmitButton></ActionForm>
    {canPublish ? <ActionForm action={archiveOccurrence}><input type="hidden" name="id" value={id} /><SubmitButton variant="secondary">Archive event</SubmitButton></ActionForm> : null}
  </div>;
}

export function NewSeries() {
  return <details className="mb-5 rounded border border-brown/20 bg-linen p-4">
    <summary className="min-h-11 cursor-pointer py-3 font-semibold text-brown">Add a repeating night</summary>
    <ActionForm action={createSeries} className="mt-4 grid gap-4 sm:grid-cols-2">
      <div><Label htmlFor="series-name">Name</Label><TextInput id="series-name" name="title" required maxLength={120} /></div>
      <div><Label htmlFor="series-day">Every</Label><Select id="series-day" name="weekday">{['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((day,i) => <option value={i} key={day}>{day}</option>)}</Select></div>
      <div><Label htmlFor="series-start">Starts (Chicago time)</Label><TextInput id="series-start" name="startTime" type="time" required /></div>
      <div><Label htmlFor="series-end">Ends</Label><TextInput id="series-end" name="endTime" type="time" required /></div>
      <SubmitButton>Create paused series</SubmitButton>
    </ActionForm>
  </details>;
}
