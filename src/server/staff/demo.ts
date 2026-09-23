import { CHICAGO_LOCATION_ID } from '@/content/locations';
import { oneTimeEvents } from '@/content/events';
import { REQUIREMENT_IDS } from '@/content/staff-reference';
import type { Row } from '@/lib/db/types';
import { addDays, weekOf, zonedInstant } from '@/lib/staff/time';
import { stableUuid } from '@/lib/stable-uuid';



const TZ = 'America/Chicago';
const L = CHICAGO_LOCATION_ID;
const id = (key: string) => stableUuid('staff-demo', key);

export const DEMO_EMPLOYEES = {
  sam: id('employee:sam'),
  alex: id('employee:alex'),
  carlos: id('employee:carlos'),
  maria: id('employee:maria'),
  jose: id('employee:jose'),
  dani: id('employee:dani'),
} as const;

export const DEMO_CONTRACTORS = { enzo: id('contractor:enzo'), sofia: id('contractor:sofia') } as const;

export const DEMO_MODULES = {
  welcome: id('module:welcome'),
  scanner: id('module:door-scanner'),
  alcohol: id('module:alcohol-service'),
  listening: id('module:vinyl-vermouth'),
} as const;

/** Local user ids match src/server/auth.ts LOCAL_STAFF; a Supabase seed nulls them. */
const LOCAL_USERS: Record<string, string> = { sam: 'local-owner', alex: 'local-manager', carlos: 'local-staff' };

function todayIn(tz: string, now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function eventOn(date: string): string | null {
  return oneTimeEvents.find((event) => event.date === date)?.id ?? null;
}

export function buildStaffDemo(now = new Date(), options: { userIds?: boolean } = {}): Record<string, Row[]> {
  const useUsers = options.userIds ?? true;
  const today = todayIn(TZ, now);
  const week = weekOf(today);
  const monday = week[0]!;
  const stamp = now.toISOString();
  const at = (date: string, minutes: number) => zonedInstant(date, minutes, TZ);
  const person = (key: keyof typeof DEMO_EMPLOYEES, row: Row): Row => ({
    id: DEMO_EMPLOYEES[key],
    user_id: useUsers ? (LOCAL_USERS[key] ?? null) : null,
    last_name: '',
    preferred_name: null,
    phone: null,
    status: 'active',
    employment_type: 'part_time',
    primary_location_id: L,
    manager_employee_id: DEMO_EMPLOYEES.alex,
    hire_date: addDays(today, -400),
    start_date: addDays(today, -400),
    end_date: null,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    emergency_contact_relationship: null,
    shirt_size: 'M',
    preferred_language: 'en',
    birthday_month: null,
    birthday_day: null,
    photo_path: null,
    notification_email: true,
    onboarding_completed_at: addDays(today, -390),
    first_shift_confirmed_at: addDays(today, -390),
    created_by: null,
    created_at: stamp,
    archived_at: null,
    ...row,
  });

  const employees: Row[] = [
    person('sam', { first_name: 'Alessandro', last_name: 'Costa', email: 'owner@example.invalid', phone: '(312) 555-0100', employment_type: 'full_time', manager_employee_id: null }),
    person('alex', { first_name: 'Nico', last_name: 'Moretti', email: 'manager@example.invalid', phone: '(312) 555-0101', employment_type: 'full_time', manager_employee_id: DEMO_EMPLOYEES.sam }),
    person('carlos', { first_name: 'Marco', last_name: 'Bellini', email: 'marco@example.invalid', phone: '(312) 555-0102', emergency_contact_name: 'Elena Bellini', emergency_contact_phone: '(312) 555-0199', emergency_contact_relationship: 'Mother', preferred_language: 'en' }),
    person('maria', { first_name: 'Sofia', last_name: 'Russo', email: 'sofia@example.invalid', phone: '(312) 555-0103', emergency_contact_name: 'Matteo Russo', emergency_contact_phone: '(312) 555-0198', emergency_contact_relationship: 'Husband' }),
    person('jose', { first_name: 'Luca', last_name: 'Romano', email: 'luca@example.invalid', phone: '(312) 555-0104', emergency_contact_name: 'Lucia Romano', emergency_contact_phone: '(312) 555-0197', emergency_contact_relationship: 'Sister', hire_date: addDays(today, -40), start_date: addDays(today, -40), onboarding_completed_at: addDays(today, -35), first_shift_confirmed_at: addDays(today, -35) }),
    person('dani', { first_name: 'Mia', last_name: 'Caruso', email: 'mia@example.invalid', phone: '(312) 555-0105', status: 'active', hire_date: addDays(today, -3), start_date: addDays(today, 5), shirt_size: null, onboarding_completed_at: null, first_shift_confirmed_at: null }),
  ];

  const positionLink = (key: keyof typeof DEMO_EMPLOYEES, positionId: string, primary: boolean): Row => ({ id: id(`pos:${key}:${positionId}`), employee_id: DEMO_EMPLOYEES[key], position_id: positionId, is_primary: primary, since: addDays(today, -400) });
  const employee_positions: Row[] = [
    positionLink('sam', 'manager', true),
    positionLink('alex', 'manager', true),
    positionLink('carlos', 'bartender', true),
    positionLink('carlos', 'server', false),
    positionLink('maria', 'server', true),
    positionLink('maria', 'bartender', false),
    positionLink('jose', 'kitchen', true),
    positionLink('jose', 'security', false),
    positionLink('dani', 'host', true),
  ];
  const employee_locations: Row[] = (Object.keys(DEMO_EMPLOYEES) as (keyof typeof DEMO_EMPLOYEES)[]).map((key) => ({ id: id(`loc:${key}`), employee_id: DEMO_EMPLOYEES[key], location_id: L }));

  /* ------------------------------------------------------------- training */

  const lesson = (key: keyof typeof DEMO_MODULES, row: Row): Row => ({
    id: DEMO_MODULES[key],
    description: null,
    category: 'general',
    estimated_minutes: 15,
    required: true,
    applies_to_positions: [],
    applies_to_locations: [],
    passing_score: null,
    retrain_interval_days: null,
    version: 1,
    status: 'published',
    created_by: null,
    created_at: stamp,
    updated_at: stamp,
    archived_at: null,
    ...row,
  });
  const training_modules: Row[] = [
    lesson('welcome', { slug: 'welcome-to-cosa-nostra', title: 'Welcome to Cosa Nostra', description: 'Who we are, how a night runs, and what guests remember.', estimated_minutes: 10 }),
    lesson('scanner', { slug: 'door-scanner', title: 'Door & QR scanner', description: 'Checking tickets in with the Cosa Nostra scanner, what each result means, and when to get a manager.', category: 'door', estimated_minutes: 15, passing_score: 80, applies_to_positions: ['door', 'security', 'manager'], retrain_interval_days: 365 }),
    lesson('alcohol', { slug: 'alcohol-service', title: 'Alcohol service', description: 'Checking IDs, cutting someone off kindly, and what Cosa Nostra policy says.', category: 'bar', estimated_minutes: 20, passing_score: 80, applies_to_positions: ['bartender', 'server', 'manager'], retrain_interval_days: 365, version: 2 }),
    lesson('listening', { slug: 'vinyl-vermouth-operations', title: 'Vinyl & Vermouth operations', description: 'Setting the room, the DJ booth, and the timing of a listening night.', category: 'events', estimated_minutes: 12, required: false, applies_to_positions: ['event_staff', 'server', 'host', 'manager'] }),
  ];
  const section = (moduleKey: keyof typeof DEMO_MODULES, sort: number, row: Row): Row => ({ id: id(`section:${moduleKey}:${sort}`), module_id: DEMO_MODULES[moduleKey], sort, kind: 'text', title: '', body: null, media_url: null, items: [], created_at: stamp, ...row });
  const training_sections: Row[] = [
    section('welcome', 10, { title: 'What Cosa Nostra is', body: 'Cosa Nostra is a Italian kitchen and bar in Chicago that turns into a venue at night: Vinyl & Vermouth, After Hours Saturday, birthdays, private events. Guests come for the food and stay for the room. Your job, whatever your position, is that they leave planning to come back.' }),
    section('welcome', 20, { title: 'A night at Cosa Nostra', body: 'Doors open at the time on the event. The host greets, the door scans tickets, the bar and floor keep pace with the room. The manager on duty makes the calls; when you are not sure, ask them before a guest notices.' }),
    section('welcome', 30, { kind: 'checklist', title: 'Before your first shift', items: ['Finish your onboarding checklist', 'Know where the office, the breaker panel and the first-aid kit are', 'Save the manager on duty number in your phone', 'Read the closing procedure for your position'] }),
    section('scanner', 10, { title: 'The scanner', body: 'The door phone opens the Cosa Nostra scanner at /admin/scan. Point the camera at the QR on the guest’s phone or printout. Green means in; hold the phone steady and read the name back.' }),
    section('scanner', 20, { title: 'The four results', body: 'Green: valid, first scan — let them in. Amber, "already scanned": a second scan of the same ticket — find the first person or get a manager. Red, "void" or "refunded": do not admit; a manager can look the order up. Grey, "wrong event": the ticket is for another night.' }),
    section('scanner', 30, { title: 'No QR', body: 'Search by name or order number. If the guest bought under a different name, the order email is the fastest way to find it. Never admit on a screenshot of a scanned-in ticket.' }),
    section('alcohol', 10, { title: 'Checking ID', body: 'Every guest who looks under 40 shows ID before their first drink. Acceptable: a state ID or driver’s licence, a passport, a military ID. Expired ID is not ID. Look at the photo, the date of birth and the hologram, in that order.' }),
    section('alcohol', 20, { title: 'Slowing down and cutting off', body: 'Water first, food second, a quieter word third. Cutting someone off is a manager’s call to back — tell the manager on duty before you do it, and never argue at the bar. The guest’s ride home is part of the job.' }),
    section('alcohol', 30, { kind: 'link', title: 'Cosa Nostra alcohol policy', body: 'The full policy is in your documents. Read it once a year.', media_url: '/staff/documents' }),
    section('listening', 10, { title: 'Setting the room', body: 'Set the listening tables with candles and menus. Test both turntables and cue headphones before doors. Confirm the selector’s arrival, volume limits and first set with the floor lead.' }),
    section('listening', 20, { kind: 'checklist', title: 'Listening night checklist', items: ['Listening tables and aperitivo portions checked against the guest list', 'Turntables, mixer and cue headphones tested', 'DJ booth stocked with record sleeves, water and the running order', 'Wristbands and scanner phones at the door', 'Bar stocked for the first pour at doors'] }),
  ];
  const question = (moduleKey: keyof typeof DEMO_MODULES, sort: number, kind: string, prompt: string, options: string[], correct: number[], explanation: string): { question: Row; key: Row } => {
    const qid = id(`question:${moduleKey}:${sort}`);
    const opts = options.map((text, index) => ({ id: `o${index + 1}`, text }));
    return {
      question: { id: qid, module_id: DEMO_MODULES[moduleKey], sort, kind, prompt, options: opts },
      key: { question_id: qid, correct_option_ids: correct.map((index) => `o${index + 1}`), explanation },
    };
  };
  const quiz = [
    question('scanner', 10, 'multiple_choice', 'A ticket scans amber, "already scanned". What do you do?', ['Let them in — the scanner glitched', 'Find the first person who used it or get a manager', 'Send them to the bar to sort it out'], [1], 'A second scan of the same ticket is the one case a manager decides.'),
    question('scanner', 20, 'true_false', 'A screenshot of a ticket that already shows "scanned in" is fine to admit.', ['True', 'False'], [1], 'A scanned-in screenshot is how one ticket becomes two people.'),
    question('scanner', 30, 'multi_select', 'Which results mean do not admit? Choose all that apply.', ['Green — valid', 'Red — void or refunded', 'Grey — wrong event', 'Amber — already scanned'], [1, 2], 'Red and grey are never admitted. Amber goes to a manager.'),
    question('alcohol', 10, 'multiple_choice', 'Which of these is acceptable ID at Cosa Nostra?', ['An expired driver’s licence', 'A photo of a passport on a phone', 'A military ID', 'A college student card'], [2], 'A real, unexpired government ID. Photos of IDs are not IDs.'),
    question('alcohol', 20, 'true_false', 'Before cutting a guest off, you tell the manager on duty.', ['True', 'False'], [0], 'The manager backs the call; you never make it alone at the bar.'),
    question('alcohol', 30, 'multi_select', 'What comes before a cut-off? Choose all that apply.', ['Water', 'Food', 'A quieter word', 'An argument at the bar'], [0, 1, 2], 'Water, food and a quiet word, in that order. Never the argument.'),
  ];

  const assignment = (key: string, moduleKey: keyof typeof DEMO_MODULES, employee: keyof typeof DEMO_EMPLOYEES, row: Row): Row => ({
    id: id(`assignment:${key}`),
    module_id: DEMO_MODULES[moduleKey],
    employee_id: DEMO_EMPLOYEES[employee],
    assigned_by: null,
    assigned_at: addDays(today, -30),
    due_on: null,
    status: 'assigned',
    started_at: null,
    completed_at: null,
    expires_at: null,
    completed_version: null,
    score: null,
    attempts: 0,
    created_at: stamp,
    updated_at: stamp,
    ...row,
  });
  const training_assignments: Row[] = [
    assignment('carlos-alcohol', 'alcohol', 'carlos', { status: 'completed', completed_at: addDays(today, -200), completed_version: 1, score: 100, attempts: 1, expires_at: `${addDays(today, 165)}T00:00:00.000Z` }),
    assignment('carlos-welcome', 'welcome', 'carlos', { status: 'completed', completed_at: addDays(today, -390), completed_version: 1, attempts: 0 }),
    assignment('maria-alcohol', 'alcohol', 'maria', { status: 'completed', completed_at: addDays(today, -20), completed_version: 2, score: 92, attempts: 1, expires_at: `${addDays(today, 345)}T00:00:00.000Z` }),
    assignment('maria-welcome', 'welcome', 'maria', { status: 'completed', completed_at: addDays(today, -390), completed_version: 1 }),
    assignment('jose-scanner', 'scanner', 'jose', { status: 'in_progress', started_at: addDays(today, -2), due_on: addDays(today, -1), assigned_at: addDays(today, -10) }),
    assignment('jose-welcome', 'welcome', 'jose', { status: 'completed', completed_at: addDays(today, -35), completed_version: 1 }),
    assignment('dani-welcome', 'welcome', 'dani', { assigned_at: addDays(today, -3), due_on: addDays(today, 4) }),
    assignment('dani-listening', 'listening', 'dani', { assigned_at: addDays(today, -3), due_on: addDays(today, 12) }),
    assignment('alex-scanner', 'scanner', 'alex', { status: 'completed', completed_at: addDays(today, -100), completed_version: 1, score: 100, attempts: 1 }),
    assignment('alex-alcohol', 'alcohol', 'alex', { status: 'completed', completed_at: addDays(today, -100), completed_version: 2, score: 100, attempts: 1 }),
  ];

  /* ---------------------------------------------------------- requirements */

  const requirement = (key: string, employee: keyof typeof DEMO_EMPLOYEES, typeId: string, row: Row): Row => ({
    id: id(`requirement:${key}`),
    employee_id: DEMO_EMPLOYEES[employee],
    requirement_type_id: typeId,
    status: 'missing',
    file_path: null,
    file_name: null,
    credential_number: null,
    issued_on: null,
    expires_on: null,
    acknowledged_at: null,
    submitted_at: null,
    verified_by: null,
    verified_at: null,
    note: null,
    created_at: stamp,
    updated_at: stamp,
    ...row,
  });
  const done = { status: 'complete', acknowledged_at: addDays(today, -390), submitted_at: addDays(today, -390) };
  const employee_requirements: Row[] = [
    ...(['carlos', 'maria', 'jose'] as const).flatMap((who) => [
      requirement(`${who}-welcome`, who, REQUIREMENT_IDS.welcome, done),
      requirement(`${who}-uniform`, who, REQUIREMENT_IDS.uniform, done),
      requirement(`${who}-policies`, who, REQUIREMENT_IDS.policies, done),
      requirement(`${who}-payroll`, who, REQUIREMENT_IDS.payroll, { status: 'complete', verified_at: addDays(today, -380) }),
    ]),
    requirement('carlos-basset', 'carlos', REQUIREMENT_IDS.basset, { status: 'complete', credential_number: 'BS-44120', issued_on: addDays(today, -1075), expires_on: addDays(today, 20), file_name: 'basset-card.jpg', submitted_at: addDays(today, -1070), verified_at: addDays(today, -1069) }),
    requirement('carlos-food', 'carlos', REQUIREMENT_IDS.foodHandler, { status: 'complete', issued_on: addDays(today, -300), expires_on: addDays(today, 795), file_name: 'food-handler.pdf', submitted_at: addDays(today, -299), verified_at: addDays(today, -298) }),
    requirement('maria-basset', 'maria', REQUIREMENT_IDS.basset, { status: 'submitted', issued_on: addDays(today, -5), expires_on: addDays(today, 1090), file_name: 'basset.pdf', submitted_at: addDays(today, -1) }),
    requirement('maria-food', 'maria', REQUIREMENT_IDS.foodHandler, { status: 'complete', issued_on: addDays(today, -1200), expires_on: addDays(today, -105), file_name: 'food-handler.pdf', submitted_at: addDays(today, -1199), verified_at: addDays(today, -1198) }),
    requirement('dani-welcome', 'dani', REQUIREMENT_IDS.welcome, { status: 'complete', acknowledged_at: addDays(today, -2), submitted_at: addDays(today, -2) }),
    requirement('dani-uniform', 'dani', REQUIREMENT_IDS.uniform, {}),
    requirement('dani-policies', 'dani', REQUIREMENT_IDS.policies, {}),
    requirement('dani-payroll', 'dani', REQUIREMENT_IDS.payroll, {}),
  ];

  /* ------------------------------------------------------------- schedule */

  const shift = (key: string, employee: keyof typeof DEMO_EMPLOYEES | null, position: string, date: string, start: number, end: number, row: Row = {}): Row => {
    const endDate = end <= start ? addDays(date, 1) : date;
    return {
      id: id(`shift:${key}`),
      location_id: L,
      employee_id: employee ? DEMO_EMPLOYEES[employee] : null,
      position_id: position,
      starts_at: at(date, start),
      ends_at: at(endDate, end),
      event_id: eventOn(date),
      note: null,
      status: 'published',
      published_at: addDays(monday, -3),
      repeat_group_id: null,
      clock_in_at: null,
      clock_out_at: null,
      break_minutes: 0,
      attendance_status: 'not_tracked',
      attendance_note: null,
      corrected_by: null,
      corrected_at: null,
      created_by: null,
      updated_by: null,
      created_at: stamp,
      updated_at: stamp,
      archived_at: null,
      ...row,
    };
  };
  const shifts: Row[] = [];
  for (let offset = -7; offset < 14; offset += 7) {
    const base = addDays(monday, offset);
    const status = offset === 7 ? 'draft' : 'published';
    const tag = offset === -7 ? 'last' : offset === 0 ? 'this' : 'next';
    const nightShift = (key: string, employee: keyof typeof DEMO_EMPLOYEES | null, position: string, day: number, start: number, end: number, row: Row = {}) => shifts.push(shift(`${tag}:${key}`, employee, position, addDays(base, day), start, end, { status, published_at: status === 'published' ? addDays(base, -3) : null, ...row }));
    nightShift('alex-mon', 'alex', 'manager', 0, 15 * 60, 23 * 60);
    nightShift('alex-wed', 'alex', 'manager', 2, 15 * 60, 23 * 60);
    nightShift('alex-thu', 'alex', 'manager', 3, 16 * 60, 60);
    nightShift('alex-fri', 'alex', 'manager', 4, 16 * 60, 90);
    nightShift('alex-sat', 'alex', 'manager', 5, 16 * 60, 90);
    nightShift('carlos-tue', 'carlos', 'bartender', 1, 16 * 60, 23 * 60);
    // Every night has a crew, so "today" in the demo is never empty.
    nightShift('carlos-wed', 'carlos', 'bartender', 2, 17 * 60, 23 * 60, { note: 'Aperitivo Club — batch the spritzes before five.' });
    nightShift('carlos-thu', 'carlos', 'bartender', 3, 17 * 60, 60);
    nightShift('carlos-fri', 'carlos', 'bartender', 4, 17 * 60, 90, { note: 'After Hours Saturday prep after close: restock the well.' });
    nightShift('carlos-sat', 'carlos', 'bartender', 5, 17 * 60, 90);
    nightShift('carlos-sun', 'carlos', 'server', 6, 15 * 60, 22 * 60);
    nightShift('maria-mon', 'maria', 'server', 0, 16 * 60, 22 * 60);
    nightShift('maria-tue', 'maria', 'server', 1, 15 * 60, 22 * 60);
    nightShift('open-wed-host', null, 'host', 2, 16 * 60, 22 * 60);
    nightShift('maria-fri', 'maria', 'server', 4, 17 * 60, 90);
    nightShift('maria-sat', 'maria', 'bartender', 5, 20 * 60 + 30, 90);
    nightShift('maria-sun', 'maria', 'server', 6, 15 * 60, 22 * 60);
    nightShift('jose-fri', 'jose', 'kitchen', 4, 15 * 60, 23 * 60);
    nightShift('jose-sat', 'jose', 'kitchen', 5, 15 * 60, 23 * 60);
    nightShift('open-sat-server', null, 'server', 5, 17 * 60, 90);
    if (offset === 0) nightShift('dani-first', 'dani', 'host', 5, 16 * 60, 22 * 60, { note: 'First shift — shadow Sofia until 7.' });
  }
  // Last week's shifts get attendance, so the record has something in it.
  const lastWeek = shifts.filter((row) => String(row.starts_at) < at(monday, 0));
  for (const row of lastWeek) {
    if (!row.employee_id) continue;
    const start = Date.parse(String(row.starts_at));
    const end = Date.parse(String(row.ends_at));
    const lateBy = String(row.id) === id('shift:last:carlos-fri') ? 14 : 0;
    row.clock_in_at = new Date(start + lateBy * 60_000).toISOString();
    row.clock_out_at = new Date(end + 6 * 60_000).toISOString();
    row.attendance_status = lateBy > 5 ? 'late' : 'on_time';
  }

  const shift_history: Row[] = shifts.map((row, index) => ({ id: index + 1, shift_id: row.id, changed_by: null, changed_at: String(row.created_at), reason: 'created', before: null, after: row }));

  // Last week and this week are out; next week is a manager's working copy,
  // which is what an employee sees as "being prepared".
  const schedule_periods: Row[] = [
    { id: id('period:last'), location_id: L, week_start: addDays(monday, -7), status: 'published', published_at: addDays(monday, -10), published_by: null, notified_at: addDays(monday, -10), note: null, created_at: addDays(monday, -12), updated_at: stamp },
    { id: id('period:this'), location_id: L, week_start: monday, status: 'published', published_at: addDays(monday, -3), published_by: null, notified_at: addDays(monday, -3), note: null, created_at: addDays(monday, -5), updated_at: stamp },
    { id: id('period:next'), location_id: L, week_start: addDays(monday, 7), status: 'draft', published_at: null, published_by: null, notified_at: null, note: null, created_at: addDays(today, -1), updated_at: stamp },
  ];

  const availability_rules: Row[] = [
    ...[0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ id: id(`avail:carlos:${weekday}`), employee_id: DEMO_EMPLOYEES.carlos, weekday, available: weekday !== 1, start_minutes: weekday === 2 ? 16 * 60 : null, end_minutes: null, note: null, updated_at: stamp })),
    ...[0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ id: id(`avail:maria:${weekday}`), employee_id: DEMO_EMPLOYEES.maria, weekday, available: weekday !== 3, start_minutes: null, end_minutes: weekday === 0 ? 18 * 60 : null, note: weekday === 3 ? 'Class on Wednesdays' : null, updated_at: stamp })),
    ...[4, 5, 6].map((weekday) => ({ id: id(`avail:jose:${weekday}`), employee_id: DEMO_EMPLOYEES.jose, weekday, available: true, start_minutes: 17 * 60, end_minutes: null, note: null, updated_at: stamp })),
  ];
  const availability_exceptions: Row[] = [
    { id: id('exception:carlos:1'), employee_id: DEMO_EMPLOYEES.carlos, on_date: addDays(today, 25), available: false, start_minutes: null, end_minutes: null, note: 'Family in town', created_at: stamp },
  ];
  const time_off_requests: Row[] = [
    { id: id('timeoff:carlos:approved'), employee_id: DEMO_EMPLOYEES.carlos, starts_on: addDays(today, 25), ends_on: addDays(today, 26), reason: 'Family visiting', note: null, status: 'approved', decided_by: null, decided_at: addDays(today, -2), decision_note: 'Enjoy it.', created_at: addDays(today, -4), updated_at: stamp },
    { id: id('timeoff:maria:pending'), employee_id: DEMO_EMPLOYEES.maria, starts_on: addDays(today, 12), ends_on: addDays(today, 13), reason: 'Wedding out of town', note: 'Can work the Thursday before.', status: 'pending', decided_by: null, decided_at: null, decision_note: null, created_at: addDays(today, -1), updated_at: stamp },
    { id: id('timeoff:jose:denied'), employee_id: DEMO_EMPLOYEES.jose, starts_on: addDays(today, -20), ends_on: addDays(today, -20), reason: null, note: null, status: 'denied', decided_by: null, decided_at: addDays(today, -25), decision_note: 'That is the sold-out Saturday — can you do the Sunday instead?', created_at: addDays(today, -27), updated_at: stamp },
  ];
  const shift_requests: Row[] = [
    { id: id('shiftrequest:maria-sat'), shift_id: id('shift:this:maria-sat'), kind: 'cover', requested_by: DEMO_EMPLOYEES.maria, swap_shift_id: null, claimed_by: null, claimed_at: null, status: 'open', note: 'Something came up Saturday. Can anyone take the bar?', decided_by: null, decided_at: null, decision_note: null, created_at: addDays(today, -1), updated_at: stamp },
  ];

  /* --------------------------------------------------------------- tasks */

  const nextEvent = oneTimeEvents.filter((event) => event.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
  const task = (key: string, row: Row): Row => ({ id: id(`task:${key}`), description: null, assigned_to: null, assigned_by: null, location_id: L, event_id: null, due_at: null, priority: 'normal', status: 'open', completed_at: null, created_at: addDays(today, -2), updated_at: stamp, archived_at: null, ...row });
  const tasks: Row[] = [
    task('qr-sign', { title: 'Print Vinyl & Vermouth QR sign', assigned_to: DEMO_EMPLOYEES.maria, event_id: nextEvent?.id ?? null, due_at: at(nextEvent?.date ?? addDays(today, 2), 15 * 60), priority: 'high' }),
    task('hdmi', { title: 'Replace HDMI cable at projector', description: 'The one at the projector cuts out. Spare in the office drawer.', assigned_to: DEMO_EMPLOYEES.carlos, due_at: at(addDays(today, -1), 17 * 60), priority: 'urgent' }),
    task('records', { title: 'Pick up records from the art supply', assigned_to: DEMO_EMPLOYEES.jose, due_at: at(addDays(today, 1), 12 * 60) }),
    task('confirm-dj', { title: 'Confirm DJ for Saturday', assigned_to: DEMO_EMPLOYEES.alex, due_at: at(addDays(today, 1), 18 * 60), priority: 'high' }),
    task('recap', { title: 'Upload Saturday recap photos', assigned_to: DEMO_EMPLOYEES.carlos, status: 'done', completed_at: addDays(today, -5), created_at: addDays(today, -7) }),
  ];

  const template = (key: string, row: Row, items: string[]): { template: Row; items: Row[] } => {
    const tid = id(`template:${key}`);
    return {
      template: { id: tid, description: null, kind: 'other', location_id: L, position_id: null, active: true, created_by: null, created_at: stamp, updated_at: stamp, archived_at: null, ...row },
      items: items.map((label, index) => ({ id: id(`template-item:${key}:${index}`), template_id: tid, sort: (index + 1) * 10, label, requires_photo: /photo/i.test(label), requires_note: false })),
    };
  };
  const templates = [
    template('opening', { title: 'Opening checklist', kind: 'opening' }, ['Turn TVs on', 'Check bathrooms', 'Unlock patio', 'Music on, volume to daytime', 'Host stand: menus, crayons, reservations printed']),
    template('closing', { title: 'Closing checklist', kind: 'closing' }, ['Lock patio', 'Bathrooms checked and restocked', 'Bar restocked for tomorrow', 'TVs and projector off', 'Upload end-of-night photos', 'Alarm set']),
    template('event', { title: 'Event night setup', kind: 'event' }, ['Set projector visual', 'Prepare wristbands', 'Test scanner phones', 'Verify event capacity on the door list', 'Set up DJ booth', 'Doors sign out front']),
  ];
  const run = (key: string, templateKey: string, row: Row): { run: Row; items: Row[] } => {
    const source = templates.find((entry) => entry.template.id === id(`template:${templateKey}`))!;
    const rid = id(`run:${key}`);
    return {
      run: { id: rid, template_id: source.template.id, title: source.template.title, on_date: today, location_id: L, event_id: null, shift_id: null, position_id: null, assigned_employee_id: null, status: 'open', started_at: null, completed_at: null, verified_by: null, verified_at: null, created_by: null, created_at: stamp, updated_at: stamp, ...row },
      items: source.items.map((item, index) => ({ id: id(`run-item:${key}:${index}`), run_id: rid, sort: item.sort, label: item.label, requires_photo: item.requires_photo, requires_note: false, completed_at: index < 2 && key === 'opening-today' ? at(today, 10 * 60 + index * 5) : null, completed_by: index < 2 && key === 'opening-today' ? DEMO_EMPLOYEES.maria : null, note: null, photo_path: null })),
    };
  };
  const runs = [run('opening-today', 'opening', { started_at: at(today, 10 * 60) }), run('closing-today', 'closing', { assigned_employee_id: DEMO_EMPLOYEES.carlos })];

  /* ------------------------------------------------- contractors & events */

  const contractors: Row[] = [
    { id: DEMO_CONTRACTORS.enzo, name: 'Enzo Vale', company_name: 'DJ Enzo', phone: '(312) 555-0150', email: 'dj@example.com', service_type: 'dj', default_rate_cents: 40000, payment_method_note: 'Zelle, night of', w9_status: 'received', notes: 'Brings own controller. Needs the XLR at the DJ booth.', user_id: null, active: true, created_at: stamp, updated_at: stamp, archived_at: null },
    { id: DEMO_CONTRACTORS.sofia, name: 'Elena Voss', company_name: 'Studio Voss', phone: '(312) 555-0151', email: 'sofia@example.invalid', service_type: 'photographer', default_rate_cents: 15000, payment_method_note: 'Check', w9_status: 'requested', notes: 'Arrives an hour before. Photo brief and table schedule shared in advance.', user_id: useUsers ? 'local-contractor' : null, active: true, created_at: stamp, updated_at: stamp, archived_at: null },
  ];
  const contractor_bookings: Row[] = [];
  const event_assignments: Row[] = [];
  // Sofia's booking goes on a night that has not happened yet, so the
  // contractor's own screen has something on it in a fresh checkout.
  const futureEvent = oneTimeEvents.filter((event) => event.date > today).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
  if (nextEvent) {
    contractor_bookings.push({ id: id('booking:sofia-next'), contractor_id: DEMO_CONTRACTORS.sofia, event_id: (futureEvent ?? nextEvent).id, location_id: L, role: 'photographer', starts_at: at((futureEvent ?? nextEvent).date, (futureEvent ?? nextEvent).startMinutes - 60), ends_at: at((futureEvent ?? nextEvent).date, (futureEvent ?? nextEvent).endMinutes), status: 'confirmed', agreed_cents: 15000, deposit_cents: 0, paid_cents: 0, payment_status: 'unpaid', payment_note: 'Check on the night', paid_on: null, note: 'Capture arrivals, table details and the first listening set.', arrival_note: 'Park behind the building and come in the kitchen door. Ask for Nico — the DJ booth is set up by 5.', created_by: null, created_at: stamp, updated_at: stamp });
    const assign = (key: string, employee: keyof typeof DEMO_EMPLOYEES, role: string, shiftKey: string | null) => event_assignments.push({ id: id(`assignment-event:${key}`), event_id: nextEvent.id, employee_id: DEMO_EMPLOYEES[employee], role, shift_id: shiftKey ? id(`shift:${shiftKey}`) : null, starts_at: null, ends_at: null, note: null, status: 'confirmed', created_by: null, created_at: stamp, updated_at: stamp });
    assign('alex', 'alex', 'event_manager', null);
    assign('jose', 'jose', 'door', null);
    assign('carlos', 'carlos', 'bartender', null);
  }
  const event_briefs: Row[] = nextEvent
    ? [
        {
          event_id: nextEvent.id,
          call_time_at: at(nextEvent.date, nextEvent.startMinutes - 90),
          dress_code: 'All black. Closed-toe shoes.',
          expected_guests: 180,
          manager_employee_id: DEMO_EMPLOYEES.alex,
          staff_notes: 'ID everyone at the door — no exceptions on a ticketed night. Bar runs two wells; the second opens at doors.',
          updated_by: null,
          created_at: stamp,
          updated_at: stamp,
        },
      ]
    : [];

  const lastEvent = oneTimeEvents.filter((event) => event.date < today).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  if (lastEvent) {
    contractor_bookings.push({ id: id('booking:enzo-last'), contractor_id: DEMO_CONTRACTORS.enzo, event_id: lastEvent.id, location_id: L, role: 'dj', starts_at: at(lastEvent.date, lastEvent.startMinutes), ends_at: at(lastEvent.endMinutes <= lastEvent.startMinutes ? addDays(lastEvent.date, 1) : lastEvent.date, lastEvent.endMinutes), status: 'completed', agreed_cents: 40000, deposit_cents: 10000, paid_cents: 10000, payment_status: 'deposit_paid', payment_note: 'Deposit paid by Zelle', paid_on: null, note: null, created_by: null, created_at: stamp, updated_at: stamp });
  }

  /* ------------------------------------------------- announcements & notes */

  const staff_announcements: Row[] = [
    { id: id('announcement:closing'), title: 'New closing procedure', body: 'Starting this week, the last person out photographs the bar and the patio lock and uploads both in the closing checklist. It takes a minute and it ends the "who locked the patio" question for good.', kind: 'general', location_id: L, positions: [], event_id: null, requires_ack: true, published_at: addDays(today, -1), expires_at: null, created_by: null, author_name: 'Nico Moretti', created_at: addDays(today, -1), updated_at: stamp, archived_at: null },
    { id: id('announcement:parking'), title: 'Parking change this Saturday', body: 'The lot behind the building is reserved for the listening night. Use the designated team entrance and check the evening brief.', kind: 'urgent', location_id: L, positions: [], event_id: nextEvent?.id ?? null, requires_ack: false, published_at: stamp, expires_at: addDays(today, 3), created_by: null, author_name: 'Nico Moretti', created_at: stamp, updated_at: stamp, archived_at: null },
  ];
  const staff_announcement_reads: Row[] = [
    { id: id('read:maria-closing'), announcement_id: id('announcement:closing'), employee_id: DEMO_EMPLOYEES.maria, read_at: addDays(today, -1), acknowledged_at: addDays(today, -1) },
  ];
  const staff_notifications: Row[] = [
    { id: id('notification:carlos:1'), employee_id: DEMO_EMPLOYEES.carlos, kind: 'schedule_published', title: 'Your schedule for this week is out', body: null, href: '/staff/schedule', entity_type: null, entity_id: null, emailed_at: null, read_at: null, created_at: addDays(monday, -3) },
    { id: id('notification:carlos:2'), employee_id: DEMO_EMPLOYEES.carlos, kind: 'task_assigned', title: 'New task: Replace HDMI cable at projector', body: null, href: '/staff/tasks', entity_type: 'task', entity_id: id('task:hdmi'), emailed_at: null, read_at: null, created_at: addDays(today, -2) },
    { id: id('notification:carlos:3'), employee_id: DEMO_EMPLOYEES.carlos, kind: 'time_off_decided', title: 'Your time off was approved', body: 'Enjoy it.', href: '/staff/time-off', entity_type: 'time_off_request', entity_id: id('timeoff:carlos:approved'), emailed_at: null, read_at: addDays(today, -2), created_at: addDays(today, -2) },
  ];
  const employee_notes: Row[] = [
    { id: id('note:carlos:1'), employee_id: DEMO_EMPLOYEES.carlos, author_id: null, author_name: 'Nico Moretti', kind: 'recognition', body: 'Handled the double-scan on Saturday exactly right — found the first guest, no drama.', created_at: addDays(today, -6), archived_at: null },
    { id: id('note:jose:1'), employee_id: DEMO_EMPLOYEES.jose, author_id: null, author_name: 'Nico Moretti', kind: 'follow_up', body: 'Scanner training due; check in before Friday.', created_at: addDays(today, -3), archived_at: null },
  ];
  const incidents: Row[] = [
    { id: id('incident:1'), occurred_at: at(addDays(today, -8), 23 * 60 + 40), location_id: L, event_id: lastEvent?.id ?? null, category: 'guest', summary: 'Guest tried to re-enter on a friend’s scanned ticket', description: 'Two guests, one ticket. Door held the second at the line; manager looked up the order and sold a door ticket.', actions_taken: 'Door ticket sold. No further issue.', attachment_paths: [], follow_up_status: 'closed', reported_by: null, reporter_name: 'Nico Moretti', created_at: addDays(today, -8), updated_at: stamp, archived_at: null },
  ];
  const incident_employees: Row[] = [{ id: id('incident-employee:1'), incident_id: id('incident:1'), employee_id: DEMO_EMPLOYEES.jose, involvement: 'responded' }];

  return {
    employees,
    employee_positions,
    employee_locations,
    employee_notes,
    employee_requirements,
    training_modules,
    training_sections,
    training_questions: quiz.map((entry) => entry.question),
    training_answer_keys: quiz.map((entry) => entry.key),
    training_assignments,
    training_attempts: [],
    shifts,
    shift_history,
    schedule_periods,
    availability_rules,
    availability_exceptions,
    time_off_requests,
    shift_requests,
    tasks,
    checklist_templates: templates.map((entry) => entry.template),
    checklist_template_items: templates.flatMap((entry) => entry.items),
    checklist_runs: runs.map((entry) => entry.run),
    checklist_run_items: runs.flatMap((entry) => entry.items),
    contractors,
    contractor_bookings,
    event_assignments,
    event_briefs,
    staff_announcements,
    staff_announcement_reads,
    staff_notifications,
    ops_comments: [],
    incidents,
    incident_employees,
    ops_audit_log: [],
  };
}

/** The order the demo tables must be written in, so foreign keys resolve. */
export const STAFF_DEMO_ORDER = [
  'employees', 'employee_positions', 'employee_locations', 'employee_notes', 'employee_requirements',
  'training_modules', 'training_sections', 'training_questions', 'training_answer_keys', 'training_assignments',
  'shifts', 'shift_history', 'schedule_periods', 'availability_rules', 'availability_exceptions', 'time_off_requests', 'shift_requests',
  'tasks', 'checklist_templates', 'checklist_template_items', 'checklist_runs', 'checklist_run_items',
  'contractors', 'contractor_bookings', 'event_assignments', 'event_briefs', 'staff_announcements', 'staff_announcement_reads',
  'staff_notifications', 'incidents', 'incident_employees',
] as const;
