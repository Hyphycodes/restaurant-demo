'use server';

import type { QuestionKind, TrainingSectionKind } from '@/content/staff-types';
import { formatDate } from '@/lib/staff/time';
import { recordOpsAudit } from '@/server/staff/audit';
import { withEmailDetails } from '@/server/staff/emails';
import { listEmployees } from '@/server/staff/employees';
import { notify } from '@/server/staff/notifications';
import { answerKeys, assignModule, completeAssignment, getAssignment, getModule, grade, listAssignments, recordAttempt, saveModule, startAssignment, type ModuleInput } from '@/server/staff/training';
import { bool, fail, integer, isoDate, list, optional, runOps, savedOps, text, type ActionState } from './shared';

export async function beginTraining(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('training.view_self', async ({ db, context }) => {
    const employee = context.employee;
    if (!employee) return fail('Your account is not set up as an employee yet.');
    await startAssignment(db, text(form, 'assignmentId'), employee.id);
    return savedOps('');
  });
}

/** A module with no quiz: the employee says they have read it. Elevated, because completion is not an employee column. */
export async function finishReading(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('training.view_self', async ({ elevated, context }) => {
    const employee = context.employee;
    if (!employee) return fail('Your account is not set up as an employee yet.');
    const moduleId = text(form, 'moduleId');
    const [assignment, lesson] = await Promise.all([getAssignment(elevated, employee.id, moduleId), getModule(elevated, moduleId)]);
    if (!assignment || !lesson) return fail('That training is not assigned to you.');
    if (lesson.questions.length > 0) return fail('This module ends with a quiz. Take the quiz to complete it.');
    await completeAssignment(elevated, assignment.id, { score: null, version: lesson.version, retrainIntervalDays: lesson.retrainIntervalDays });
    return savedOps(`${lesson.title} complete. Nice.`);
  });
}

/** Grades on the server. The answers never reach the browser before this. */
export async function submitQuiz(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('training.view_self', async ({ elevated, context }) => {
    const employee = context.employee;
    if (!employee) return fail('Your account is not set up as an employee yet.');
    const moduleId = text(form, 'moduleId');
    const [assignment, lesson] = await Promise.all([getAssignment(elevated, employee.id, moduleId), getModule(elevated, moduleId)]);
    if (!assignment || !lesson) return fail('That training is not assigned to you.');
    if (lesson.questions.length === 0) return fail('This module has no quiz.');
    const answers: Record<string, string[]> = {};
    for (const question of lesson.questions) answers[question.id] = list(form, `q:${question.id}`);
    const unanswered = lesson.questions.filter((question) => (answers[question.id] ?? []).length === 0);
    if (unanswered.length > 0) return fail(`Answer every question first (${unanswered.length} left).`);
    const result = grade(lesson.questions, await answerKeys(elevated, moduleId), answers, lesson.passingScore);
    await recordAttempt(elevated, assignment, lesson, answers, result);
    return {
      ok: true,
      message: result.passed ? `You passed with ${result.score}%.` : `${result.score}% — you need ${result.passingScore}% to pass. Read it again and try once more.`,
      errors: Object.fromEntries(result.review.map((entry) => [entry.questionId, entry.correct ? 'correct' : `wrong:${entry.correctOptionIds.join(',')}${entry.explanation ? `:${entry.explanation}` : ''}`])),
    };
  });
}

export async function assignTraining(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('training.manage', async ({ db, context }) => {
    const moduleId = text(form, 'moduleId');
    const lesson = await getModule(db, moduleId);
    if (!lesson) return fail('That module no longer exists.');
    let employeeIds = list(form, 'employeeIds');
    if (bool(form, 'everyone')) {
      employeeIds = (await listEmployees(db)).filter((employee) => lesson.appliesToPositions.length === 0 || lesson.appliesToPositions.some((id) => employee.positionIds.includes(id))).map((employee) => employee.id);
    }
    if (employeeIds.length === 0) return fail('Pick at least one person.');
    const dueOn = isoDate(optional(form, 'dueOn'));
    const created = await assignModule(db, moduleId, employeeIds, context.staff, dueOn);
    await recordOpsAudit(context.staff, 'training.assigned', 'training_module', moduleId, { after: { employeeIds: created, dueOn } });
    if (created.length > 0) {
      await notify(
        withEmailDetails(
          { employeeIds: created, kind: 'training_assigned', title: `New training: ${lesson.title}`, href: `/staff/training/${moduleId}`, entityType: 'training_module', entityId: moduleId, email: lesson.required ? { subject: 'Training assigned', intro: `A required training module was assigned to you.${lesson.estimatedMinutes ? ` It takes about ${lesson.estimatedMinutes} minutes.` : ''}`, cta: 'Start training' } : null },
          { headline: `New training: ${lesson.title}.`, details: [{ label: 'Module', value: lesson.title }, ...(dueOn ? [{ label: 'Due', value: formatDate(dueOn) }] : []), ...(lesson.passingScore ? [{ label: 'Passing score', value: `${lesson.passingScore}%` }] : [])] },
        ),
      );
    }
    return savedOps(created.length === 0 ? 'Everyone picked already has this module.' : `Assigned to ${created.length} ${created.length === 1 ? 'person' : 'people'}.`);
  });
}

export async function markTrainingComplete(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('training.manage', async ({ elevated, context }) => {
    const assignmentId = text(form, 'assignmentId');
    const assignment = (await listAssignments(elevated)).find((entry) => entry.id === assignmentId);
    if (!assignment) return fail('That assignment no longer exists.');
    await completeAssignment(elevated, assignmentId, { score: null, version: assignment.module.version, retrainIntervalDays: assignment.module.retrainIntervalDays });
    await recordOpsAudit(context.staff, 'training.marked_complete', 'training_assignment', assignmentId, { before: assignment as never, after: { completed: true, by: context.staff.name } });
    return savedOps(`Marked complete for ${assignment.employeeName}.`);
  });
}

function moduleInputFrom(form: FormData): { input: ModuleInput; error: string | null } {
  const title = text(form, 'title');
  if (!title) return { input: null as never, error: 'Give the module a title.' };
  const slug = (optional(form, 'slug') ?? title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const sectionCount = integer(form, 'sectionCount') ?? 0;
  const sections: ModuleInput['sections'] = [];
  for (let index = 0; index < sectionCount; index += 1) {
    const kind = text(form, `s${index}kind`) as TrainingSectionKind;
    const sectionTitle = text(form, `s${index}title`);
    const body = optional(form, `s${index}body`);
    const mediaUrl = optional(form, `s${index}media`);
    if (!sectionTitle && !body && !mediaUrl) continue;
    sections.push({ kind: ['text', 'video', 'image', 'checklist', 'link'].includes(kind) ? kind : 'text', title: sectionTitle, body, mediaUrl, items: kind === 'checklist' ? (body ?? '').split('\n').map((line) => line.trim()).filter(Boolean) : [] });
  }
  const questionCount = integer(form, 'questionCount') ?? 0;
  const questions: ModuleInput['questions'] = [];
  for (let index = 0; index < questionCount; index += 1) {
    const prompt = text(form, `q${index}prompt`);
    if (!prompt) continue;
    const kind = text(form, `q${index}kind`) as QuestionKind;
    const rawOptions = (optional(form, `q${index}options`) ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
    const options = kind === 'true_false' ? ['True', 'False'] : rawOptions;
    if (options.length < 2) return { input: null as never, error: `Question ${index + 1} needs at least two options.` };
    const correct = list(form, `q${index}correct`).map((entry) => Number(entry)).filter((entry) => Number.isInteger(entry) && entry >= 0 && entry < options.length);
    if (correct.length === 0) return { input: null as never, error: `Mark the correct answer for question ${index + 1}.` };
    questions.push({
      kind: ['multiple_choice', 'true_false', 'multi_select'].includes(kind) ? kind : 'multiple_choice',
      prompt,
      options: options.map((textValue, optionIndex) => ({ id: `o${optionIndex + 1}`, text: textValue })),
      correctOptionIds: correct.map((entry) => `o${entry + 1}`),
      explanation: optional(form, `q${index}explanation`),
    });
  }
  return {
    input: {
      slug,
      title,
      description: optional(form, 'description'),
      category: text(form, 'category') || 'general',
      estimatedMinutes: integer(form, 'estimatedMinutes'),
      required: bool(form, 'required'),
      appliesToPositions: list(form, 'positions'),
      appliesToLocations: list(form, 'locations'),
      passingScore: integer(form, 'passingScore'),
      retrainIntervalDays: integer(form, 'retrainIntervalDays'),
      status: text(form, 'status') === 'published' ? 'published' : text(form, 'status') === 'archived' ? 'archived' : 'draft',
      sections,
      questions,
    },
    error: null,
  };
}

export async function saveTrainingModule(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('training.manage', async ({ db, context }) => {
    const { input, error } = moduleInputFrom(form);
    if (error) return fail(error);
    const id = optional(form, 'id');
    const bump = bool(form, 'requireAgain');
    const row = await saveModule(db, id, input, context.staff, bump);
    await recordOpsAudit(context.staff, id ? (bump ? 'training.new_version' : 'training.edited') : 'training.created', 'training_module', String(row.id), { after: { title: input.title, version: row.version, status: input.status } });
    if (bump && input.status === 'published') {
      const assignments = await listAssignments(db, { moduleId: String(row.id) });
      const affected = assignments.filter((assignment) => assignment.status === 'completed').map((assignment) => assignment.employeeId);
      if (affected.length > 0) {
        await notify({ employeeIds: affected, kind: 'training_assigned', title: `${input.title} was updated — please complete the new version`, href: `/staff/training/${String(row.id)}`, entityType: 'training_module', entityId: String(row.id), email: { subject: 'Training updated', intro: 'A module you completed changed enough that it needs doing again.', cta: 'Open the module' } });
      }
    }
    return { ...savedOps(id ? (bump ? 'Saved as a new version. Everyone who completed it has been asked to do it again.' : 'Module saved.') : 'Module created.'), affected: [`/staff/training/${String(row.id)}`] };
  });
}
