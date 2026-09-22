import 'server-only';

import type { Row } from '@/lib/db/types';
import type { Staff } from '@/server/auth';
import { opsElevatedDb } from './db';

/**
 * The management audit trail for staff data.
 *
 * Every action a manager takes that changes someone else's record lands
 * here: who, what, the row before and after. Written with the elevated
 * handle because no client may write it, and never awaited in a way that
 * can fail the action — a lost audit line is logged, a lost schedule change
 * is not acceptable.
 */

const SECRET_KEYS = new Set(['file_path', 'photo_path', 'attachment_paths', 'answers', 'draft']);

function scrub(value: Row | null | undefined): Row | null {
  if (!value) return null;
  const copy: Row = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SECRET_KEYS.has(key)) continue;
    copy[key] = entry;
  }
  return copy;
}

export async function recordOpsAudit(
  actor: Staff,
  action: string,
  entityType: string,
  entityId: string | null,
  change: { before?: Row | null; after?: Row | null } = {},
): Promise<void> {
  try {
    const db = opsElevatedDb();
    if (!db) return;
    await db.insert('ops_audit_log', {
      actor: actor.source === 'supabase' ? actor.id : null,
      actor_name: actor.name || actor.email || actor.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      before: scrub(change.before),
      after: scrub(change.after),
      at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn(`[ops-audit] ${action} ${entityType} ${entityId ?? ''}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export interface OpsAuditEntry {
  id: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  at: string;
  before: Row | null;
  after: Row | null;
}

export async function recentOpsAudit(limit = 50, filter: { entityType?: string; entityId?: string } = {}): Promise<OpsAuditEntry[]> {
  const db = opsElevatedDb();
  if (!db) return [];
  const where: Record<string, string> = {};
  if (filter.entityType) where.entity_type = filter.entityType;
  if (filter.entityId) where.entity_id = filter.entityId;
  const rows = await db.list<Row>('ops_audit_log', { where, orderBy: 'at', desc: true, limit });
  return rows.map((row) => ({
    id: String(row.id),
    actorName: String(row.actor_name ?? ''),
    action: String(row.action),
    entityType: String(row.entity_type),
    entityId: (row.entity_id as string | null) ?? null,
    at: String(row.at),
    before: (row.before as Row | null) ?? null,
    after: (row.after as Row | null) ?? null,
  }));
}
