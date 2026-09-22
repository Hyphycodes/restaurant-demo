import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db, ListOptions, Row } from './types';
import { primaryKey } from './types';

/**
 * PostgREST adapter.
 *
 * The client handed in decides the authorization context, and that choice is the
 * whole security model of this file:
 *
 *   - a SESSION client carries the signed-in staff member's JWT, so Row Level
 *     Security and the publish trigger apply. Every admin write uses this.
 *   - a SERVICE client bypasses RLS. Used only for reading published public
 *     content during SSR. Auth provisioning uses a separate service client only after explicit owner authorization or verified first-owner onboarding.
 *
 * This adapter therefore adds no authorization of its own, deliberately: it must
 * not become a place where a check can be forgotten. Authorization lives in the
 * database and in `requireCapability` on the server-action side.
 */
export class SupabaseDb implements Db {
  readonly kind = 'supabase' as const;

  constructor(private readonly client: SupabaseClient) {}

  async list<T extends Row>(table: string, options: ListOptions = {}): Promise<T[]> {
    let query = this.client.from(table).select('*');

    for (const [column, value] of Object.entries(options.where ?? {})) {
      query = value === null ? query.is(column, null) : query.eq(column, value);
    }
    for (const [column, values] of Object.entries(options.whereIn ?? {})) {
      if (values.length === 0) return [];
      query = query.in(column, [...values]);
    }
    if (options.range) {
      const { column, from, to } = options.range;
      if (from !== undefined) query = query.gte(column, from);
      if (to !== undefined) query = query.lt(column, to);
    }
    if (options.orderBy) query = query.order(options.orderBy, { ascending: !options.desc });
    if (typeof options.limit === 'number') query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    return (data ?? []) as T[];
  }

  async get<T extends Row>(table: string, id: string): Promise<T | null> {
    const { data, error } = await this.client
      .from(table)
      .select('*')
      .eq(primaryKey(table), id)
      .maybeSingle();
    if (error) throw new Error(`${table}: ${error.message}`);
    return (data as T | null) ?? null;
  }

  async insert<T extends Row>(table: string, row: Row): Promise<T> {
    const { data, error } = await this.client.from(table).insert(row).select().single();
    if (error) throw new Error(`${table}: ${error.message}`);
    return data as T;
  }

  async update<T extends Row>(table: string, id: string, patch: Row): Promise<T> {
    const { data, error } = await this.client
      .from(table)
      .update(patch)
      .eq(primaryKey(table), id)
      .select()
      .single();
    if (error) throw new Error(`${table}: ${error.message}`);
    return data as T;
  }

  async upsert<T extends Row>(table: string, row: Row): Promise<T> {
    const { data, error } = await this.client
      .from(table)
      .upsert(row, { onConflict: primaryKey(table) })
      .select()
      .single();
    if (error) throw new Error(`${table}: ${error.message}`);
    return data as T;
  }

  async remove(table: string, id: string): Promise<void> {
    const { error } = await this.client.from(table).delete().eq(primaryKey(table), id);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}
