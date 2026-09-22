/**
 * The smallest database surface the admin actually needs.
 *
 * Every repository in `src/server/content/` is written against this interface and
 * nothing else, so the Supabase adapter and the local development adapter cannot
 * drift apart in behaviour — there is one write path, not two.
 *
 * It is deliberately not a query builder. Anything more expressive would be a
 * feature the local adapter has to reimplement, and a place the two could differ.
 */

export type Row = Record<string, unknown>;

export interface ListOptions {
  /** Equality filters, ANDed. `null` matches SQL `is null`. */
  where?: Record<string, string | number | boolean | null>;
  /** Membership filters, ANDed with `where`. An empty list matches nothing. */
  whereIn?: Record<string, readonly (string | number)[]>;
  /**
   * One inclusive-from, exclusive-to window on a column, for "the shifts this
   * week" without loading every shift ever. Values compare as ISO strings.
   */
  range?: { column: string; from?: string; to?: string };
  /** Column to sort by, ascending unless `desc`. */
  orderBy?: string;
  desc?: boolean;
  limit?: number;
}

export interface Db {
  /** Rows matching `where`, in `orderBy` order. Never throws on empty. */
  list<T extends Row>(table: string, options?: ListOptions): Promise<T[]>;
  /** One row by primary key, or null. */
  get<T extends Row>(table: string, id: string): Promise<T | null>;
  insert<T extends Row>(table: string, row: Row): Promise<T>;
  /** Partial update by primary key. Returns the updated row. */
  update<T extends Row>(table: string, id: string, patch: Row): Promise<T>;
  /** Insert or update by primary key. */
  upsert<T extends Row>(table: string, row: Row): Promise<T>;
  /**
   * Hard delete. Used only for rows that are genuinely transient — a draft that
   * was never published, a generated occurrence being regenerated. Content that
   * a guest has seen is archived, never deleted.
   */
  remove(table: string, id: string): Promise<void>;
  /** Which adapter answered. Surfaced in the admin so nobody is guessing. */
  readonly kind: 'supabase' | 'local';
}

/**
 * Primary key column per table. The adapters need it; `id` is not universal here
 * because menus and event series are keyed by their public slug, which is the
 * whole point — the slug is a stable public identifier, not a surrogate.
 */
export const PRIMARY_KEY: Record<string, string> = {
  announcements: 'id',
  audit_log: 'id',
  catering_items: 'id',
  catering_packages: 'id',
  content_versions: 'id',
  event_occurrences: 'id',
  event_series: 'slug',
  inquiries: 'id',
  media_assets: 'asset_id',
  menu_categories: 'id',
  menu_items: 'id',
  menu_modifiers: 'id',
  menus: 'slug',
  page_lists: 'id',
  page_sections: 'id',
  page_seo: 'page',
  profiles: 'user_id',
  site_settings: 'id',
  site_themes: 'slug',
  special_hours: 'id',
  waitlist: 'id',
  ticket_tiers: 'id',
  promo_codes: 'id',
  orders: 'id',
  order_items: 'id',
  tickets: 'id',
  ticket_holds: 'id',
  scans: 'id',
  processed_stripe_events: 'id',
  email_log: 'id',
  email_settings: 'template_id',
  rate_limits: 'key',
  // Employee operations (migration 0022).
  locations: 'id',
  positions: 'id',
  employees: 'id',
  employee_positions: 'id',
  employee_locations: 'id',
  employee_notes: 'id',
  requirement_types: 'id',
  employee_requirements: 'id',
  training_modules: 'id',
  training_sections: 'id',
  training_questions: 'id',
  training_answer_keys: 'question_id',
  training_assignments: 'id',
  training_attempts: 'id',
  shifts: 'id',
  shift_history: 'id',
  schedule_periods: 'id',
  availability_rules: 'id',
  availability_exceptions: 'id',
  time_off_requests: 'id',
  shift_requests: 'id',
  tasks: 'id',
  checklist_templates: 'id',
  checklist_template_items: 'id',
  checklist_runs: 'id',
  checklist_run_items: 'id',
  contractors: 'id',
  contractor_bookings: 'id',
  event_assignments: 'id',
  staff_announcements: 'id',
  staff_announcement_reads: 'id',
  staff_notifications: 'id',
  ops_comments: 'id',
  incidents: 'id',
  incident_employees: 'id',
  ops_audit_log: 'id',
  // The schedule week and the night brief (migration 0025).
  event_briefs: 'event_id',
  // Hiring and local talent (migration 0026).
  job_openings: 'id',
  job_applications: 'id',
  talent_submissions: 'id',
  // Link Hubs (migration 0023).
  link_hub_locations: 'id',
  link_hubs: 'id',
  link_hub_modes: 'id',
  link_hub_blocks: 'id',
  link_hub_analytics: 'id',
  link_hub_leads: 'id',
};

export function primaryKey(table: string): string {
  const key = PRIMARY_KEY[table];
  if (!key) throw new Error(`Unknown table "${table}" — add it to PRIMARY_KEY.`);
  return key;
}
