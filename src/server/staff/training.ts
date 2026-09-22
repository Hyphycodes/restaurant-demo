import 'server-only';

import type { EmployeeSummary, QuestionKind, QuizResult, TrainingAssignment, TrainingModuleDetail, TrainingModuleSummary, TrainingQuestion, TrainingSection, TrainingSectionKind, TrainingStatus } from '@/content/staff-types';
import type { Db, Row } from '@/lib/db/types';
import { addDays } from '@/lib/staff/time';
import type { Staff } from '@/server/auth';
import { employeeMap } from './employees';



export function moduleFromRow(row: Row, hasQuiz: boolean): TrainingModuleSummary {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    description: (row.description as string | null) ?? null,
    category: String(row.category ?? 'general'),
    estimatedMinutes: (row.estimated_minutes as number | null) ?? null,
    required: row.required === true,
    appliesToPositions: (row.applies_to_positions as string[]) ?? [],
    appliesToLocations: (row.applies_to_locations as string[]) ?? [],
    passingScore: (row.passing_score as number | null) ?? null,
    retrainIntervalDays: (row.retrain_interval_days as number | null) ?? null,
    version: Number(row.version ?? 1),
    status: (row.status as TrainingModuleSummary['status']) ?? 'draft',
    hasQuiz,
    updatedAt: String(row.updated_at ?? row.created_at ?? ''),
  };
}

function sectionFromRow(row: Row): TrainingSection {
  return {
    id: String(row.id),
    sort: Number(row.sort ?? 0),
    kind: (row.kind as TrainingSectionKind) ?? 'text',
    title: String(row.title ?? ''),
    body: (row.body as string | null) ?? null,
    mediaUrl: (row.media_url as string | null) ?? null,
    items: (row.items as string[]) ?? [],
  };
}

function questionFromRow(row: Row): TrainingQuestion {
  const options = Array.isArray(row.options) ? (row.options as { id: string; text: string }[]) : [];
  return { id: String(row.id), sort: Number(row.sort ?? 0), kind: (row.kind as QuestionKind) ?? 'multiple_choice', prompt: String(row.prompt), options };
}

export async function listModules(db: Db, options: { includeDrafts?: boolean } = {}): Promise<TrainingModuleSummary[]> {
  const [rows, questions] = await Promise.all([db.list<Row>('training_modules', { orderBy: 'title' }), db.list<Row>('training_questions')]);
  const withQuiz = new Set(questions.map((row) => String(row.module_id)));
  return rows
    .filter((row) => !row.archived_at)
    .map((row) => moduleFromRow(row, withQuiz.has(String(row.id))))
    .filter((module) => options.includeDrafts || module.status === 'published');
}

export async function getModule(db: Db, id: string): Promise<TrainingModuleDetail | null> {
  const row = await db.get<Row>('training_modules', id);
  if (!row || row.archived_at) return null;
  const [sections, questions] = await Promise.all([
    db.list<Row>('training_sections', { where: { module_id: id }, orderBy: 'sort' }),
    db.list<Row>('training_questions', { where: { module_id: id }, orderBy: 'sort' }),
  ]);
  return { ...moduleFromRow(row, questions.length > 0), sections: sections.map(sectionFromRow), questions: questions.map(questionFromRow) };
}

export function assignmentFromRow(row: Row, module: TrainingModuleSummary, employeeName: string, today: string): TrainingAssignment {
  const completedVersion = (row.completed_version as number | null) ?? null;
  const status = (row.status as TrainingStatus) ?? 'assigned';
  const expiresAt = (row.expires_at as string | null) ?? null;
  const expired = status === 'completed' && expiresAt !== null && expiresAt.slice(0, 10) < today;
  const outdated = status === 'completed' && completedVersion !== null && completedVersion < module.version;
  const dueOn = (row.due_on as string | null) ?? null;
  return {
    id: String(row.id),
    moduleId: String(row.module_id),
    employeeId: String(row.employee_id),
    employeeName,
    module,
    status: expired ? 'expired' : status,
    dueOn,
    startedAt: (row.started_at as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    expiresAt,
    completedVersion,
    score: (row.score as number | null) ?? null,
    attempts: Number(row.attempts ?? 0),
    outdated,
    overdue: (status !== 'completed' || outdated || expired) && dueOn !== null && dueOn < today,
  };
}

export async function listAssignments(db: Db, filter: { employeeId?: string; moduleId?: string; today?: string } = {}): Promise<TrainingAssignment[]> {
  const where: Record<string, string> = {};
  if (filter.employeeId) where.employee_id = filter.employeeId;
  if (filter.moduleId) where.module_id = filter.moduleId;
  const today = filter.today ?? new Date().toISOString().slice(0, 10);
  const [rows, modules, employees] = await Promise.all([db.list<Row>('training_assignments', { where, orderBy: 'assigned_at', desc: true }), listModules(db, { includeDrafts: true }), employeeMap(db)]);
  const byId = new Map(modules.map((module) => [module.id, module]));
  return rows
    .map((row) => {
      const lesson = byId.get(String(row.module_id));
      if (!lesson || lesson.status === 'archived') return null;
      return assignmentFromRow(row, lesson, employees.get(String(row.employee_id))?.displayName ?? 'Employee', today);
    })
    .filter((assignment): assignment is TrainingAssignment => assignment !== null);
}

/** Assignments that still need doing: not completed, outdated, or expired. */
export function outstanding(assignments: TrainingAssignment[]): TrainingAssignment[] {
  return assignments.filter((assignment) => assignment.status !== 'completed' || assignment.outdated);
}

export async function getAssignment(db: Db, employeeId: string, moduleId: string): Promise<TrainingAssignment | null> {
  const list = await listAssignments(db, { employeeId, moduleId });
  return list[0] ?? null;
}

/* ------------------------------------------------------------------ writes */

export async function assignModule(db: Db, moduleId: string, employeeIds: string[], actor: Staff, dueOn: string | null): Promise<string[]> {
  const created: string[] = [];
  for (const employeeId of employeeIds) {
    const existing = await db.list<Row>('training_assignments', { where: { module_id: moduleId, employee_id: employeeId } });
    if (existing[0]) {
      if (dueOn) await db.update('training_assignments', String(existing[0].id), { due_on: dueOn });
      continue;
    }
    await db.insert('training_assignments', {
      module_id: moduleId,
      employee_id: employeeId,
      assigned_by: actor.source === 'supabase' ? actor.id : null,
      assigned_at: new Date().toISOString(),
      due_on: dueOn,
      status: 'assigned',
      attempts: 0,
      created_at: new Date().toISOString(),
    });
    created.push(employeeId);
  }
  return created;
}

/** Assigns every published, required module that applies to this employee. Used at onboarding. */
export async function assignRequiredModules(db: Db, employee: EmployeeSummary, actor: Staff): Promise<number> {
  const modules = await listModules(db);
  let count = 0;
  for (const lesson of modules) {
    if (!lesson.required) continue;
    const positionOk = lesson.appliesToPositions.length === 0 || lesson.appliesToPositions.some((id) => employee.positionIds.includes(id));
    const locationOk = lesson.appliesToLocations.length === 0 || lesson.appliesToLocations.some((id) => employee.locationIds.includes(id) || employee.primaryLocationId === id);
    if (!positionOk || !locationOk) continue;
    count += (await assignModule(db, lesson.id, [employee.id], actor, addDays(new Date().toISOString().slice(0, 10), 14))).length;
  }
  return count;
}

export async function startAssignment(db: Db, assignmentId: string, employeeId: string): Promise<void> {
  const row = await db.get<Row>('training_assignments', assignmentId);
  if (!row || row.employee_id !== employeeId) throw new Error('That training is not assigned to you.');
  if (row.status === 'assigned') await db.update('training_assignments', assignmentId, { status: 'in_progress', started_at: new Date().toISOString() });
}

/** Marks a module without a quiz complete, or records a manager's manual completion. Elevated write. */
export async function completeAssignment(db: Db, assignmentId: string, input: { score: number | null; version: number; retrainIntervalDays: number | null }): Promise<Row> {
  const now = new Date().toISOString();
  return db.update<Row>('training_assignments', assignmentId, {
    status: 'completed',
    completed_at: now,
    completed_version: input.version,
    score: input.score,
    expires_at: input.retrainIntervalDays ? `${addDays(now.slice(0, 10), input.retrainIntervalDays)}T00:00:00.000Z` : null,
  });
}

/**
 * Grades a submission and records the attempt. Pure grading is separated so
 * the tests cover multi-select, true/false and the passing threshold
 * without a database.
 */
export function grade(
  questions: TrainingQuestion[],
  keys: Map<string, { correct: string[]; explanation: string | null }>,
  answers: Record<string, string[]>,
  passingScore: number | null,
): QuizResult {
  const review = questions.map((question) => {
    const key = keys.get(question.id);
    const chosen = [...(answers[question.id] ?? [])].sort();
    const correct = [...(key?.correct ?? [])].sort();
    const right = chosen.length === correct.length && chosen.every((id, index) => id === correct[index]);
    return { questionId: question.id, correct: right, correctOptionIds: correct, explanation: key?.explanation ?? null };
  });
  const total = questions.length;
  const correct = review.filter((entry) => entry.correct).length;
  const score = total === 0 ? 100 : Math.round((correct / total) * 100);
  const passed = passingScore === null ? true : score >= passingScore;
  return { score, passed, passingScore, correct, total, review };
}

export async function answerKeys(db: Db, moduleId: string): Promise<Map<string, { correct: string[]; explanation: string | null }>> {
  const questions = await db.list<Row>('training_questions', { where: { module_id: moduleId } });
  const ids = questions.map((row) => String(row.id));
  if (ids.length === 0) return new Map();
  const rows = await db.list<Row>('training_answer_keys', { whereIn: { question_id: ids } });
  return new Map(rows.map((row) => [String(row.question_id), { correct: (row.correct_option_ids as string[]) ?? [], explanation: (row.explanation as string | null) ?? null }]));
}

/** Records an attempt and, on a pass, completes the assignment. Elevated write. */
export async function recordAttempt(db: Db, assignment: TrainingAssignment, module: TrainingModuleDetail, answers: Record<string, string[]>, result: QuizResult): Promise<void> {
  await db.insert('training_attempts', {
    assignment_id: assignment.id,
    employee_id: assignment.employeeId,
    module_id: module.id,
    version: module.version,
    answers,
    score: result.score,
    passed: result.passed,
    submitted_at: new Date().toISOString(),
  });
  await db.update('training_assignments', assignment.id, { attempts: assignment.attempts + 1, status: result.passed ? 'completed' : 'in_progress' });
  if (result.passed) await completeAssignment(db, assignment.id, { score: result.score, version: module.version, retrainIntervalDays: module.retrainIntervalDays });
}

export interface ModuleInput {
  slug: string;
  title: string;
  description: string | null;
  category: string;
  estimatedMinutes: number | null;
  required: boolean;
  appliesToPositions: string[];
  appliesToLocations: string[];
  passingScore: number | null;
  retrainIntervalDays: number | null;
  status: 'draft' | 'published' | 'archived';
  sections: { kind: TrainingSectionKind; title: string; body: string | null; mediaUrl: string | null; items: string[] }[];
  questions: { kind: QuestionKind; prompt: string; options: { id: string; text: string }[]; correctOptionIds: string[]; explanation: string | null }[];
}

/** Saves a module and its content wholesale. `bumpVersion` marks a material change. */
export async function saveModule(db: Db, id: string | null, input: ModuleInput, actor: Staff, bumpVersion: boolean): Promise<Row> {
  const now = new Date().toISOString();
  const base = {
    slug: input.slug,
    title: input.title,
    description: input.description,
    category: input.category,
    estimated_minutes: input.estimatedMinutes,
    required: input.required,
    applies_to_positions: input.appliesToPositions,
    applies_to_locations: input.appliesToLocations,
    passing_score: input.questions.length > 0 ? (input.passingScore ?? 80) : null,
    retrain_interval_days: input.retrainIntervalDays,
    status: input.status,
  };
  let row: Row;
  if (id) {
    const existing = await db.get<Row>('training_modules', id);
    if (!existing) throw new Error('That module no longer exists.');
    row = await db.update<Row>('training_modules', id, { ...base, version: bumpVersion ? Number(existing.version ?? 1) + 1 : existing.version });
    for (const section of await db.list<Row>('training_sections', { where: { module_id: id } })) await db.remove('training_sections', String(section.id));
    for (const question of await db.list<Row>('training_questions', { where: { module_id: id } })) {
      await db.remove('training_answer_keys', String(question.id)).catch(() => undefined);
      await db.remove('training_questions', String(question.id));
    }
  } else {
    row = await db.insert<Row>('training_modules', { ...base, version: 1, created_by: actor.source === 'supabase' ? actor.id : null, created_at: now });
  }
  const moduleId = String(row.id);
  let sort = 0;
  for (const section of input.sections) {
    await db.insert('training_sections', { module_id: moduleId, sort: (sort += 10), kind: section.kind, title: section.title, body: section.body, media_url: section.mediaUrl, items: section.items, created_at: now });
  }
  sort = 0;
  for (const question of input.questions) {
    const inserted = await db.insert<Row>('training_questions', { module_id: moduleId, sort: (sort += 10), kind: question.kind, prompt: question.prompt, options: question.options });
    await db.insert('training_answer_keys', { question_id: String(inserted.id), correct_option_ids: question.correctOptionIds, explanation: question.explanation });
  }
  return row;
}

export async function moduleInputFor(db: Db, id: string): Promise<ModuleInput | null> {
  const detail = await getModule(db, id);
  if (!detail) return null;
  const keys = await answerKeys(db, id);
  return {
    slug: detail.slug,
    title: detail.title,
    description: detail.description,
    category: detail.category,
    estimatedMinutes: detail.estimatedMinutes,
    required: detail.required,
    appliesToPositions: detail.appliesToPositions,
    appliesToLocations: detail.appliesToLocations,
    passingScore: detail.passingScore,
    retrainIntervalDays: detail.retrainIntervalDays,
    status: detail.status,
    sections: detail.sections.map((section) => ({ kind: section.kind, title: section.title, body: section.body, mediaUrl: section.mediaUrl, items: section.items })),
    questions: detail.questions.map((question) => ({ kind: question.kind, prompt: question.prompt, options: question.options, correctOptionIds: keys.get(question.id)?.correct ?? [], explanation: keys.get(question.id)?.explanation ?? null })),
  };
}

/** Everyone who has completed this module on its current version. */
export async function whoIsCleared(db: Db, moduleId: string): Promise<{ cleared: TrainingAssignment[]; outstanding: TrainingAssignment[] }> {
  const assignments = await listAssignments(db, { moduleId });
  return {
    cleared: assignments.filter((assignment) => assignment.status === 'completed' && !assignment.outdated),
    outstanding: assignments.filter((assignment) => assignment.status !== 'completed' || assignment.outdated),
  };
}
