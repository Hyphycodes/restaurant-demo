import { deflateSync, inflateSync } from 'node:zlib';
import type { Row } from './types';

export type DemoChanges = Record<string, Record<string, Row | null>>;
export const DEMO_STATE_PREFIX = 'cn_demo_state_';
export const DEMO_STATE_CHUNKS = 3;
export const DEMO_STATE_CHUNK_SIZE = 3000;

/** This is untrusted, fictional workspace data, never an identity or credential. */
export function decodeDemoChanges(value: string): DemoChanges {
  try {
    if (!value || value.length > DEMO_STATE_CHUNKS * DEMO_STATE_CHUNK_SIZE) return {};
    const parsed: unknown = JSON.parse(inflateSync(Buffer.from(value, 'base64url'), { maxOutputLength: 256_000 }).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const clean: DemoChanges = Object.create(null);
    for (const [table, entries] of Object.entries(parsed)) {
      if (!/^[a-z_]+$/.test(table) || ['__proto__','constructor','prototype'].includes(table) || !entries || typeof entries !== 'object' || Array.isArray(entries)) return {};
      clean[table] = Object.create(null);
      for (const [id, row] of Object.entries(entries)) {
        if (['__proto__','constructor','prototype'].includes(id) || id.length > 200 || (row !== null && (typeof row !== 'object' || Array.isArray(row)))) return {};
        clean[table]![id] = row as Row | null;
      }
    }
    return clean;
  } catch { return {}; }
}

export function encodeDemoChanges(changes: DemoChanges): string {
  const json=JSON.stringify(changes);
  if (Buffer.byteLength(json)>256_000) throw new Error('This demo workspace is full. Start a fresh browser session to continue.');
  const encoded=deflateSync(json).toString('base64url');
  if(encoded.length>DEMO_STATE_CHUNKS*DEMO_STATE_CHUNK_SIZE) throw new Error('This demo workspace is full. Start a fresh browser session to continue.');
  return encoded;
}
