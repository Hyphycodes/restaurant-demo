/**
 * View models for the staff app.
 *
 * Client components import from here, never from `src/server/staff/*` — those
 * modules start with `import 'server-only'` and pulling one into the browser
 * bundle is a build error. Every shape is plain data a native client could
 * receive as JSON.
 */

export type EmployeeStatus = 'invited' | 'active' | 'on_leave' | 'inactive';
export type EmploymentType = 'full_time' | 'part_time' | 'seasonal' | 'on_call';

export const EMPLOYEE_STATUS_LABEL: Record<EmployeeStatus, string> = {
  invited: 'Invited',
  active: 'Active',
  on_leave: 'On leave',
  inactive: 'Inactive',
};

export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  full_time: 'Full time',
  part_time: 'Part time',
  seasonal: 'Seasonal',
  on_call: 'On call',
};

export interface Position {
  id: string;
  name: string;
  department: string;
  sort: number;
  active: boolean;
}

export interface EmployeeSummary {
  id: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  /** Preferred name or first name: what a colleague calls them. */
  displayName: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: EmployeeStatus;
  employmentType: EmploymentType;
  primaryLocationId: string | null;
  positionIds: string[];
  primaryPositionId: string | null;
  locationIds: string[];
  photoPath: string | null;
  /** Signed, short-lived. Null when there is no photo. */
  photoUrl: string | null;
  hireDate: string | null;
  startDate: string | null;
  managerEmployeeId: string | null;
  onboardingCompletedAt: string | null;
  archivedAt: string | null;
  /** The admin account tier behind this person, when they have an account. */
  accessRole: 'owner' | 'admin' | 'editor' | 'staff' | 'contractor' | null;
}

export interface EmployeeDetail extends EmployeeSummary {
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
  shirtSize: string | null;
  preferredLanguage: 'en' | 'es';
  birthdayMonth: number | null;
  birthdayDay: number | null;
  notificationEmail: boolean;
  firstShiftConfirmedAt: string | null;
  endDate: string | null;
  createdAt: string;
}

export interface LocationSummary {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  timezone: string;
  active: boolean;
}

/* --------------------------------------------------------------- schedule */

export type ShiftStatus = 'draft' | 'published' | 'cancelled';

/**
 * A week of one location's schedule. `draft` is a manager's working copy —
 * employees see nothing of it and are told the week is being prepared;
 * `published` is out, and every later change tells only the person it moves.
 */
export type SchedulePeriodStatus = 'draft' | 'published';

export interface SchedulePeriod {
  id: string;
  locationId: string;
  /** The Monday, as a date in the location's own zone. */
  weekStart: string;
  status: SchedulePeriodStatus;
  publishedAt: string | null;
  /** When everyone was told. Set once; a later republish is not a broadcast. */
  notifiedAt: string | null;
  note: string | null;
}
export type AttendanceStatus = 'not_tracked' | 'on_time' | 'late' | 'absent' | 'left_early' | 'excused';

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  not_tracked: 'Not tracked',
  on_time: 'On time',
  late: 'Late',
  absent: 'Absent',
  left_early: 'Left early',
  excused: 'Excused',
};

export interface Shift {
  id: string;
  locationId: string;
  employeeId: string | null;
  positionId: string;
  startsAt: string;
  endsAt: string;
  eventId: string | null;
  note: string | null;
  status: ShiftStatus;
  publishedAt: string | null;
  repeatGroupId: string | null;
  clockInAt: string | null;
  clockOutAt: string | null;
  breakMinutes: number;
  attendanceStatus: AttendanceStatus;
  attendanceNote: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A shift with the names a screen needs beside it. */
export interface ShiftView extends Shift {
  employeeName: string | null;
  positionName: string;
  locationName: string;
  locationTimezone: string;
  event: { id: string; title: string; slug: string | null; startsAt: string; doorsAt: string | null } | null;
  /** Anything a manager should know before publishing this. */
  warnings: ScheduleWarning[];
}

/**
 * What the floor is told about a night. Operational only: the money for the
 * same event lives behind `events.view_money` and never reaches this shape.
 */
export interface EventBrief {
  eventId: string;
  callTimeAt: string | null;
  dressCode: string | null;
  expectedGuests: number | null;
  managerEmployeeId: string | null;
  managerName: string | null;
  staffNotes: string | null;
  updatedAt: string | null;
}

export type ScheduleWarningKind = 'unavailable' | 'time_off' | 'overlap' | 'inactive' | 'missing_training' | 'missing_certification';

export interface ScheduleWarning {
  kind: ScheduleWarningKind;
  message: string;
}

export interface AvailabilityRule {
  id: string;
  employeeId: string;
  weekday: number;
  available: boolean;
  startMinutes: number | null;
  endMinutes: number | null;
  note: string | null;
}

export interface AvailabilityException {
  id: string;
  employeeId: string;
  onDate: string;
  available: boolean;
  startMinutes: number | null;
  endMinutes: number | null;
  note: string | null;
}

export type TimeOffStatus = 'pending' | 'approved' | 'denied' | 'cancelled';

export interface TimeOffRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  startsOn: string;
  endsOn: string;
  reason: string | null;
  note: string | null;
  status: TimeOffStatus;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
}

export type ShiftRequestKind = 'give_up' | 'swap' | 'cover';
export type ShiftRequestStatus = 'open' | 'claimed' | 'approved' | 'denied' | 'cancelled';

export const SHIFT_REQUEST_KIND_LABEL: Record<ShiftRequestKind, string> = {
  give_up: 'Giving up this shift',
  swap: 'Looking to swap',
  cover: 'Needs cover',
};

export interface ShiftRequest {
  id: string;
  shift: ShiftView;
  kind: ShiftRequestKind;
  requestedBy: string;
  requestedByName: string;
  swapShift: ShiftView | null;
  claimedBy: string | null;
  claimedByName: string | null;
  claimedAt: string | null;
  status: ShiftRequestStatus;
  note: string | null;
  decisionNote: string | null;
  createdAt: string;
}

/* -------------------------------------------------------------- training */

export type TrainingSectionKind = 'text' | 'video' | 'image' | 'checklist' | 'link';
export type QuestionKind = 'multiple_choice' | 'true_false' | 'multi_select';
export type TrainingStatus = 'assigned' | 'in_progress' | 'completed' | 'expired';

/** A module's `category` is stored as free text, but every module editor picks from this fixed list. */
export const TRAINING_CATEGORY_ORDER = ['general', 'guest_experience', 'operations', 'bar', 'door', 'events', 'kitchen', 'safety', 'policy'] as const;
export type TrainingCategory = (typeof TRAINING_CATEGORY_ORDER)[number];

export const TRAINING_CATEGORY_LABEL: Record<TrainingCategory, string> = {
  general: 'General',
  guest_experience: 'Guest experience',
  operations: 'Operations',
  bar: 'Bar',
  door: 'Door',
  events: 'Events',
  kitchen: 'Kitchen',
  safety: 'Safety',
  policy: 'Policy',
};

/** A module's category as a display label, even if it holds a value outside the fixed list. */
export function trainingCategoryLabel(category: string): string {
  return TRAINING_CATEGORY_LABEL[category as TrainingCategory] ?? category.replace(/_/g, ' ');
}

export interface TrainingModuleSummary {
  id: string;
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
  version: number;
  status: 'draft' | 'published' | 'archived';
  hasQuiz: boolean;
  updatedAt: string;
}

export interface TrainingSection {
  id: string;
  sort: number;
  kind: TrainingSectionKind;
  title: string;
  body: string | null;
  mediaUrl: string | null;
  items: string[];
}

/** A question as the employee sees it: no answers. */
export interface TrainingQuestion {
  id: string;
  sort: number;
  kind: QuestionKind;
  prompt: string;
  options: { id: string; text: string }[];
}

export interface TrainingModuleDetail extends TrainingModuleSummary {
  sections: TrainingSection[];
  questions: TrainingQuestion[];
}

export interface TrainingAssignment {
  id: string;
  moduleId: string;
  employeeId: string;
  employeeName: string;
  module: TrainingModuleSummary;
  status: TrainingStatus;
  dueOn: string | null;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  completedVersion: number | null;
  score: number | null;
  attempts: number;
  /** Completed on an older version than the module now carries. */
  outdated: boolean;
  overdue: boolean;
}

export interface QuizResult {
  score: number;
  passed: boolean;
  passingScore: number | null;
  correct: number;
  total: number;
  /** Per question, after grading. Correct answers are only revealed here. */
  review: { questionId: string; correct: boolean; correctOptionIds: string[]; explanation: string | null }[];
}

/* ---------------------------------------------------------- requirements */

export type RequirementKind = 'acknowledgement' | 'upload' | 'link' | 'manager_verify' | 'training_module' | 'system';
export type RequirementStatus = 'missing' | 'submitted' | 'complete' | 'expired' | 'waived';

export interface RequirementType {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: string;
  kind: RequirementKind;
  systemKey: string | null;
  trainingModuleId: string | null;
  externalUrl: string | null;
  required: boolean;
  onboarding: boolean;
  appliesToPositions: string[];
  appliesToLocations: string[];
  expiresAfterDays: number | null;
  sort: number;
  active: boolean;
}

/** One requirement for one employee, with its effective state worked out. */
export interface RequirementItem {
  id: string | null;
  type: RequirementType;
  employeeId: string;
  status: RequirementStatus;
  /** What the screen should say: complete, expiring, expired, waiting, missing. */
  state: 'complete' | 'expiring' | 'expired' | 'submitted' | 'missing' | 'waived';
  filePath: string | null;
  fileName: string | null;
  /** Signed, short-lived, only when there is a file. */
  fileUrl: string | null;
  credentialNumber: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  acknowledgedAt: string | null;
  submittedAt: string | null;
  verifiedAt: string | null;
  note: string | null;
}

export interface OnboardingProgress {
  employeeId: string;
  total: number;
  complete: number;
  items: RequirementItem[];
  /** 'not_started' | 'in_progress' | 'ready' */
  stage: 'not_started' | 'in_progress' | 'ready';
}

/* --------------------------------------------------------- tasks & lists */

export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'done';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
};

export interface Task {
  id: string;
  title: string;
  description: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  assignedByName: string | null;
  locationId: string | null;
  eventId: string | null;
  eventTitle: string | null;
  dueAt: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  completedAt: string | null;
  createdAt: string;
  overdue: boolean;
}

export interface ChecklistTemplate {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  locationId: string | null;
  positionId: string | null;
  active: boolean;
  items: { id: string; sort: number; label: string; requiresPhoto: boolean; requiresNote: boolean }[];
}

export interface ChecklistRun {
  id: string;
  templateId: string;
  title: string;
  onDate: string;
  locationId: string | null;
  eventId: string | null;
  eventTitle: string | null;
  shiftId: string | null;
  positionId: string | null;
  assignedEmployeeId: string | null;
  assignedEmployeeName: string | null;
  status: 'open' | 'complete' | 'verified';
  startedAt: string | null;
  completedAt: string | null;
  verifiedAt: string | null;
  items: ChecklistRunItem[];
  done: number;
  total: number;
}

export interface ChecklistRunItem {
  id: string;
  sort: number;
  label: string;
  requiresPhoto: boolean;
  requiresNote: boolean;
  completedAt: string | null;
  completedByName: string | null;
  note: string | null;
  photoPath: string | null;
}

/* ------------------------------------------------------- event staffing */

export type StaffingRole = 'event_manager' | 'dj' | 'door' | 'security' | 'bartender' | 'server' | 'host' | 'instructor' | 'photographer' | 'other';

export const STAFFING_ROLE_LABEL: Record<StaffingRole, string> = {
  event_manager: 'Event manager',
  dj: 'DJ',
  door: 'Door',
  security: 'Security',
  bartender: 'Bartender',
  server: 'Server',
  host: 'Host',
  instructor: 'Artist / instructor',
  photographer: 'Photographer',
  other: 'Other',
};

export const STAFFING_ROLE_ORDER: StaffingRole[] = ['event_manager', 'instructor', 'dj', 'door', 'security', 'bartender', 'server', 'host', 'photographer', 'other'];

export interface EventAssignment {
  id: string;
  eventId: string;
  employeeId: string;
  employeeName: string;
  role: StaffingRole;
  shiftId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  note: string | null;
  status: 'planned' | 'confirmed' | 'cancelled';
  /** Training or certification this person is missing for the role, if any. */
  readiness: string[];
}

export type ContractorService = 'dj' | 'instructor' | 'painter' | 'band' | 'performer' | 'photographer' | 'security' | 'other';

export const CONTRACTOR_SERVICE_LABEL: Record<ContractorService, string> = {
  dj: 'DJ',
  instructor: 'Instructor',
  painter: 'Painter',
  band: 'Band',
  performer: 'Performer',
  photographer: 'Photographer',
  security: 'Security',
  other: 'Other',
};

export interface Contractor {
  id: string;
  name: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  serviceType: ContractorService;
  defaultRateCents: number | null;
  paymentMethodNote: string | null;
  w9Status: 'missing' | 'requested' | 'received';
  notes: string | null;
  active: boolean;
  /** Whether they have an account and can look up their own bookings. */
  hasSignIn: boolean;
  upcomingBookings: number;
  pastBookings: number;
}

export type BookingPaymentStatus = 'unpaid' | 'deposit_paid' | 'paid';

export interface ContractorBooking {
  id: string;
  contractorId: string;
  contractorName: string;
  locationId: string | null;
  eventId: string | null;
  eventTitle: string | null;
  eventStartsAt: string | null;
  role: ContractorService;
  startsAt: string | null;
  endsAt: string | null;
  status: 'tentative' | 'confirmed' | 'cancelled' | 'completed';
  agreedCents: number;
  depositCents: number;
  paidCents: number;
  paymentStatus: BookingPaymentStatus;
  paymentNote: string | null;
  paidOn: string | null;
  note: string | null;
  /** Written for the contractor: which door, where to park, who to ask for. */
  arrivalNote: string | null;
}

export interface EventStaffing {
  event: { id: string; title: string; slug: string | null; startsAt: string; endsAt: string; doorsAt: string | null; locationId: string | null; ticketsSold: number | null };
  assignments: EventAssignment[];
  bookings: ContractorBooking[];
  tasks: Task[];
  /** Roles the event has nobody in, from the roles it usually needs. */
  gaps: StaffingRole[];
}

/* -------------------------------------------- announcements & notices */

export interface StaffAnnouncement {
  id: string;
  title: string;
  body: string;
  kind: 'general' | 'urgent';
  locationId: string | null;
  positions: string[];
  eventId: string | null;
  eventTitle: string | null;
  requiresAck: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  authorName: string;
  createdAt: string;
  /** For the reader. */
  readAt: string | null;
  acknowledgedAt: string | null;
  /** For a manager: how many of the audience have acknowledged. */
  audience: number | null;
  acknowledged: number | null;
}

export interface StaffNotification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface OpsComment {
  id: string;
  entityType: string;
  entityId: string;
  authorName: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

/* ------------------------------------------------------------ incidents */

export type IncidentCategory = 'guest' | 'injury' | 'security' | 'equipment' | 'payment' | 'alcohol' | 'other';

export const INCIDENT_CATEGORY_LABEL: Record<IncidentCategory, string> = {
  guest: 'Guest issue',
  injury: 'Employee injury',
  security: 'Security event',
  equipment: 'Equipment damage',
  payment: 'Payment dispute',
  alcohol: 'Alcohol / service issue',
  other: 'Other',
};

export interface Incident {
  id: string;
  occurredAt: string;
  locationId: string | null;
  eventId: string | null;
  eventTitle: string | null;
  category: IncidentCategory;
  summary: string;
  description: string | null;
  actionsTaken: string | null;
  attachmentPaths: string[];
  followUpStatus: 'open' | 'monitoring' | 'closed';
  reporterName: string;
  employees: { employeeId: string; name: string; involvement: string }[];
  createdAt: string;
}

export interface EmployeeNote {
  id: string;
  employeeId: string;
  authorName: string;
  kind: 'coaching' | 'attendance' | 'recognition' | 'follow_up' | 'other';
  body: string;
  createdAt: string;
}

/* ------------------------------------------------------------- ops role */

/** What an account can do operationally. Derived, never stored. */
export type OpsRole = 'owner' | 'manager' | 'employee' | 'contractor' | 'none';


export const OPS_ROLE_LABEL: Record<OpsRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  employee: 'Staff',
  contractor: 'Contractor',
  none: 'No staff access',
};
