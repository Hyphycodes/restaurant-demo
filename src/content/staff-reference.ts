import type { Row } from '@/lib/db/types';
import { chicago } from './locations';

/**
 * Reference rows the staff system starts with: the location, the positions,
 * the onboarding checklist. Real configuration, not demo data — the same
 * rows migration 0022 inserts, kept here so the local development database
 * and `supabase/seed.sql` carry them too.
 */

export const REFERENCE_POSITIONS: Row[] = [
  { id: 'manager', name: 'Manager', department: 'management', sort: 0, active: true },
  { id: 'server', name: 'Server', department: 'front', sort: 10, active: true },
  { id: 'bartender', name: 'Bartender', department: 'bar', sort: 20, active: true },
  { id: 'host', name: 'Host', department: 'front', sort: 30, active: true },
  { id: 'busser', name: 'Busser', department: 'front', sort: 40, active: true },
  { id: 'door', name: 'Door', department: 'door', sort: 50, active: true },
  { id: 'security', name: 'Security', department: 'door', sort: 60, active: true },
  { id: 'dj', name: 'DJ', department: 'events', sort: 70, active: true },
  { id: 'event_staff', name: 'Event staff', department: 'events', sort: 80, active: true },
  { id: 'kitchen', name: 'Kitchen', department: 'kitchen', sort: 90, active: true },
  { id: 'content_social', name: 'Content & social', department: 'other', sort: 100, active: true },
];

export const REFERENCE_LOCATIONS: Row[] = [
  {
    id: chicago.id,
    slug: chicago.slug,
    name: chicago.name,
    short_name: chicago.shortName,
    street: chicago.street,
    locality: chicago.locality,
    region: chicago.region,
    postal_code: chicago.postalCode,
    timezone: chicago.timezone,
    phone: chicago.phone,
    active: true,
    sort: 0,
  },
];

function requirement(id: string, row: Row): Row {
  return { id, applies_to_positions: [], applies_to_locations: [], expires_after_days: null, external_url: null, training_module_id: null, system_key: null, active: true, archived_at: null, ...row };
}

/** Stable ids so a re-seed updates rather than duplicates. */
export const REQUIREMENT_IDS = {
  welcome: 'c05a0000-0000-4000-8000-0000000000a1',
  personalDetails: 'c05a0000-0000-4000-8000-0000000000a2',
  emergencyContact: 'c05a0000-0000-4000-8000-0000000000a3',
  availability: 'c05a0000-0000-4000-8000-0000000000a4',
  positions: 'c05a0000-0000-4000-8000-0000000000a5',
  location: 'c05a0000-0000-4000-8000-0000000000a6',
  uniform: 'c05a0000-0000-4000-8000-0000000000a7',
  policies: 'c05a0000-0000-4000-8000-0000000000a8',
  payroll: 'c05a0000-0000-4000-8000-0000000000a9',
  foodHandler: 'c05a0000-0000-4000-8000-0000000000b1',
  basset: 'c05a0000-0000-4000-8000-0000000000b2',
  firstShift: 'c05a0000-0000-4000-8000-0000000000b3',
} as const;

export const REFERENCE_REQUIREMENT_TYPES: Row[] = [
  requirement(REQUIREMENT_IDS.welcome, { slug: 'welcome', title: 'Welcome to Casa Aurelia', description: 'Read the welcome note and what to expect in your first week.', category: 'handbook', kind: 'acknowledgement', required: true, onboarding: true, sort: 0 }),
  requirement(REQUIREMENT_IDS.personalDetails, { slug: 'personal-details', title: 'Personal details', description: 'Your name, phone and how we should address you.', category: 'profile', kind: 'system', system_key: 'personal_details', required: true, onboarding: true, sort: 10 }),
  requirement(REQUIREMENT_IDS.emergencyContact, { slug: 'emergency-contact', title: 'Emergency contact', description: 'Who we call if something happens at work.', category: 'profile', kind: 'system', system_key: 'emergency_contact', required: true, onboarding: true, sort: 20 }),
  requirement(REQUIREMENT_IDS.availability, { slug: 'availability', title: 'Availability', description: 'The days and times you can work.', category: 'profile', kind: 'system', system_key: 'availability', required: true, onboarding: true, sort: 30 }),
  requirement(REQUIREMENT_IDS.positions, { slug: 'positions', title: 'Position assignment', description: 'A manager assigns the positions you work.', category: 'profile', kind: 'system', system_key: 'positions', required: true, onboarding: true, sort: 40 }),
  requirement(REQUIREMENT_IDS.location, { slug: 'location', title: 'Location assignment', description: 'A manager assigns where you work.', category: 'profile', kind: 'system', system_key: 'location', required: true, onboarding: true, sort: 50 }),
  requirement(REQUIREMENT_IDS.uniform, { slug: 'uniform', title: 'Uniform', description: 'Your shirt size and the uniform agreement.', category: 'uniform', kind: 'acknowledgement', required: true, onboarding: true, sort: 60 }),
  requirement(REQUIREMENT_IDS.policies, { slug: 'employee-policies', title: 'Employee policies', description: 'The house policies every employee acknowledges.', category: 'policy', kind: 'acknowledgement', required: true, onboarding: true, sort: 70 }),
  requirement(REQUIREMENT_IDS.payroll, { slug: 'payroll-paperwork', title: 'Tax and payroll paperwork', description: "Completed on the payroll provider's site; a manager confirms it is in.", category: 'payroll', kind: 'manager_verify', required: true, onboarding: true, sort: 80 }),
  requirement(REQUIREMENT_IDS.foodHandler, { slug: 'food-handler', title: 'Food handler certificate', description: 'Upload your certificate. Required for kitchen and food-running positions where Casa Aurelia policy says so.', category: 'certification', kind: 'upload', required: false, onboarding: true, sort: 90, expires_after_days: 1095, applies_to_positions: ['kitchen', 'server', 'busser'] }),
  requirement(REQUIREMENT_IDS.basset, { slug: 'basset', title: 'BASSET / alcohol service', description: 'Upload your BASSET card. Whether it is required per position is a Casa Aurelia policy setting.', category: 'certification', kind: 'upload', required: false, onboarding: true, sort: 100, expires_after_days: 1095, applies_to_positions: ['bartender', 'server', 'manager'] }),
  requirement(REQUIREMENT_IDS.firstShift, { slug: 'first-shift', title: 'First shift confirmed', description: 'Your first shift is on the schedule and you have confirmed it.', category: 'profile', kind: 'system', system_key: 'first_shift', required: true, onboarding: true, sort: 110 }),
];
