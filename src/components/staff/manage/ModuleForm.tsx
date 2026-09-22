'use client';

import { useState } from 'react';
import type { LocationSummary, Position } from '@/content/staff-types';
import { TRAINING_CATEGORY_LABEL, TRAINING_CATEGORY_ORDER } from '@/content/staff-types';
import type { ModuleInput } from '@/server/staff/training';
import { saveTrainingModule } from '@/server/actions/staff/training';
import { ActionForm, CheckGroup, Checkbox, Field, Fieldset, Select, SubmitButton, TextArea, TextInput } from '@/components/staff/forms';

/**
 * A module editor that works without a page builder: sections in order,
 * questions with one option per line, the correct ones ticked. Saving
 * with "require again" bumps the version and re-assigns everyone.
 */
export function ModuleForm({ id, initial, positions, locations }: { id: string | null; initial: ModuleInput | null; positions: Position[]; locations: LocationSummary[] }) {
  const [sections, setSections] = useState(initial?.sections.length ? initial.sections : [{ kind: 'text' as const, title: '', body: '', mediaUrl: '', items: [] }]);
  const [questions, setQuestions] = useState(initial?.questions ?? []);
  return (
    <ActionForm action={saveTrainingModule} className="grid gap-5">
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <input type="hidden" name="sectionCount" value={sections.length} />
      <input type="hidden" name="questionCount" value={questions.length} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field id="title" label="Title">
            <TextInput id="title" name="title" defaultValue={initial?.title ?? ''} required maxLength={120} placeholder="Door & QR scanner" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field id="description" label="One-line description">
            <TextInput id="description" name="description" defaultValue={initial?.description ?? ''} maxLength={200} />
          </Field>
        </div>
        <Field id="category" label="Category">
          <Select id="category" name="category" defaultValue={initial?.category ?? 'general'}>
            {TRAINING_CATEGORY_ORDER.map((category) => (
              <option key={category} value={category}>
                {TRAINING_CATEGORY_LABEL[category]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="estimatedMinutes" label="Minutes to complete">
          <TextInput id="estimatedMinutes" name="estimatedMinutes" type="number" min={1} inputMode="numeric" defaultValue={initial?.estimatedMinutes ?? ''} />
        </Field>
        <Field id="retrainIntervalDays" label="Retrain every (days)" hint="Blank = never expires.">
          <TextInput id="retrainIntervalDays" name="retrainIntervalDays" type="number" min={1} inputMode="numeric" defaultValue={initial?.retrainIntervalDays ?? ''} />
        </Field>
        <Field id="status" label="Status">
          <Select id="status" name="status" defaultValue={initial?.status ?? 'draft'}>
            <option value="draft">Draft (only managers see it)</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Checkbox id="required" name="required" defaultChecked={initial?.required ?? false}>
            Required — assigned automatically to new employees in these positions
          </Checkbox>
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1 text-[0.875rem] font-semibold text-brown">Applies to positions</p>
          <p className="mb-1 text-[0.8125rem] text-brown-soft">Nothing ticked = everyone.</p>
          <CheckGroup name="positions" options={positions.map((position) => ({ id: position.id, label: position.name }))} selected={initial?.appliesToPositions ?? []} />
        </div>
        {locations.length > 1 ? (
          <div className="sm:col-span-2">
            <p className="mb-1 text-[0.875rem] font-semibold text-brown">Applies to locations</p>
            <CheckGroup name="locations" options={locations.map((location) => ({ id: location.id, label: location.name }))} selected={initial?.appliesToLocations ?? []} />
          </div>
        ) : null}
      </div>

      <Fieldset legend="Content">
        {sections.map((section, index) => (
          <div key={index} className="staff-panel grid gap-3 px-4 py-3">
            <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
              <Field id={`s${index}kind`} label="Type">
                <Select id={`s${index}kind`} name={`s${index}kind`} value={section.kind} onChange={(event) => setSections((list) => list.map((entry, i) => (i === index ? { ...entry, kind: event.target.value as typeof entry.kind } : entry)))}>
                  <option value="text">Text</option>
                  <option value="video">Video</option>
                  <option value="image">Image / diagram</option>
                  <option value="checklist">Checklist</option>
                  <option value="link">External link</option>
                </Select>
              </Field>
              <Field id={`s${index}title`} label="Heading">
                <TextInput id={`s${index}title`} name={`s${index}title`} defaultValue={section.title} maxLength={120} />
              </Field>
            </div>
            {section.kind === 'video' || section.kind === 'image' || section.kind === 'link' ? (
              <Field id={`s${index}media`} label={section.kind === 'link' ? 'Link' : 'URL'} hint={section.kind === 'video' ? 'YouTube, Vimeo or a direct video link.' : undefined}>
                <TextInput id={`s${index}media`} name={`s${index}media`} type="url" defaultValue={section.mediaUrl ?? ''} />
              </Field>
            ) : null}
            <Field id={`s${index}body`} label={section.kind === 'checklist' ? 'Lines (one per row)' : 'Text'}>
              <TextArea id={`s${index}body`} name={`s${index}body`} rows={section.kind === 'checklist' ? 4 : 5} defaultValue={section.kind === 'checklist' ? section.items.join('\n') : section.body ?? ''} />
            </Field>
            <div className="flex justify-end">
              <button type="button" onClick={() => setSections((list) => list.filter((_, i) => i !== index))} className="text-[0.8125rem] font-semibold text-brown-soft underline underline-offset-4">
                Remove section
              </button>
            </div>
          </div>
        ))}
        <div>
          <button type="button" onClick={() => setSections((list) => [...list, { kind: 'text', title: '', body: '', mediaUrl: '', items: [] }])} className="inline-flex min-h-10 items-center rounded-(--radius-sm) border border-brown/30 px-3 text-[0.875rem] font-semibold text-brown">
            + Add section
          </button>
        </div>
      </Fieldset>

      <Fieldset legend="Quiz">
        <p className="text-[0.8125rem] text-brown-soft">Optional. Multiple choice, true/false or choose-all-that-apply. Tick the right answer(s). Employees never see the answers before submitting.</p>
        {questions.map((question, index) => (
          <div key={index} className="staff-panel grid gap-3 px-4 py-3">
            <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
              <Field id={`q${index}kind`} label="Type">
                <Select id={`q${index}kind`} name={`q${index}kind`} value={question.kind} onChange={(event) => setQuestions((list) => list.map((entry, i) => (i === index ? { ...entry, kind: event.target.value as typeof entry.kind, options: event.target.value === 'true_false' ? [{ id: 'o1', text: 'True' }, { id: 'o2', text: 'False' }] : entry.options } : entry)))}>
                  <option value="multiple_choice">Multiple choice</option>
                  <option value="true_false">True / false</option>
                  <option value="multi_select">Choose all that apply</option>
                </Select>
              </Field>
              <Field id={`q${index}prompt`} label="Question">
                <TextInput id={`q${index}prompt`} name={`q${index}prompt`} defaultValue={question.prompt} maxLength={300} />
              </Field>
            </div>
            {question.kind !== 'true_false' ? (
              <Field id={`q${index}options`} label="Options (one per line)">
                <TextArea id={`q${index}options`} name={`q${index}options`} rows={4} value={question.options.map((option) => option.text).join('\n')} onChange={(event) => setQuestions((list) => list.map((entry, i) => (i === index ? { ...entry, options: event.target.value.split('\n').map((text, optionIndex) => ({ id: `o${optionIndex + 1}`, text })) } : entry)))} />
              </Field>
            ) : null}
            <div>
              <p className="mb-1 text-[0.875rem] font-semibold text-brown">Correct</p>
              <div className="grid gap-1">
                {question.options.map((option, optionIndex) =>
                  option.text.trim() ? (
                    <label key={optionIndex} className="flex min-h-9 items-center gap-2 text-[0.9375rem] text-brown">
                      <input type={question.kind === 'multi_select' ? 'checkbox' : 'radio'} name={`q${index}correct`} value={optionIndex} defaultChecked={question.correctOptionIds.includes(`o${optionIndex + 1}`)} className="size-4 accent-[var(--color-coral)]" />
                      {option.text}
                    </label>
                  ) : null,
                )}
              </div>
            </div>
            <Field id={`q${index}explanation`} label="Explanation shown after answering" hint="Optional.">
              <TextInput id={`q${index}explanation`} name={`q${index}explanation`} defaultValue={question.explanation ?? ''} maxLength={300} />
            </Field>
            <div className="flex justify-end">
              <button type="button" onClick={() => setQuestions((list) => list.filter((_, i) => i !== index))} className="text-[0.8125rem] font-semibold text-brown-soft underline underline-offset-4">
                Remove question
              </button>
            </div>
          </div>
        ))}
        <div className="flex flex-wrap items-end gap-3">
          <button type="button" onClick={() => setQuestions((list) => [...list, { kind: 'multiple_choice', prompt: '', options: [], correctOptionIds: [], explanation: null }])} className="inline-flex min-h-10 items-center rounded-(--radius-sm) border border-brown/30 px-3 text-[0.875rem] font-semibold text-brown">
            + Add question
          </button>
          {questions.length > 0 ? (
            <Field id="passingScore" label="Passing score (%)">
              <TextInput id="passingScore" name="passingScore" type="number" min={1} max={100} inputMode="numeric" defaultValue={initial?.passingScore ?? 80} />
            </Field>
          ) : null}
        </div>
      </Fieldset>

      {id ? (
        <Checkbox id="requireAgain" name="requireAgain">
          This is a material change — save as a new version and ask everyone who completed it to do it again
        </Checkbox>
      ) : null}
      <div>
        <SubmitButton>{id ? 'Save module' : 'Create module'}</SubmitButton>
      </div>
    </ActionForm>
  );
}
