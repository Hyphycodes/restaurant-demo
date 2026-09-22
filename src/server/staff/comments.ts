import 'server-only';

import type { OpsComment } from '@/content/staff-types';
import type { Db, Row } from '@/lib/db/types';
import type { Staff } from '@/server/auth';

export type CommentEntity = 'task' | 'time_off_request' | 'shift_request' | 'incident' | 'event_staffing' | 'shift' | 'checklist_run';

export async function listComments(db: Db, entityType: CommentEntity, entityId: string, viewerId: string): Promise<OpsComment[]> {
  const rows = await db.list<Row>('ops_comments', { where: { entity_type: entityType, entity_id: entityId }, orderBy: 'created_at' });
  return rows.map((row) => ({
    id: String(row.id),
    entityType,
    entityId,
    authorName: String(row.author_name ?? ''),
    body: String(row.body),
    createdAt: String(row.created_at ?? ''),
    mine: row.author_id === viewerId,
  }));
}

export async function addComment(db: Db, entityType: CommentEntity, entityId: string, body: string, actor: Staff): Promise<Row> {
  return db.insert<Row>('ops_comments', {
    entity_type: entityType,
    entity_id: entityId,
    author_id: actor.source === 'supabase' ? actor.id : actor.id,
    author_name: actor.name || actor.email,
    body,
    created_at: new Date().toISOString(),
  });
}
