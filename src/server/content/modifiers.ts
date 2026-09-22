import 'server-only';
import type { Db, Row } from '@/lib/db/types';

/** Parse before saving anything: a malformed surcharge must not disappear silently. */
export function parseModifiers(choices: string, addOns: string): Row[] {
  const rows: Row[] = choices.split(/[\n,]/).map(s => s.trim()).filter(Boolean).map(label => ({ label, price_cents: null }));
  for (const line of addOns.split('\n').map(s => s.trim()).filter(Boolean)) {
    const match = /^(.*?)\s+\+?\$?(\d+(?:\.\d{1,2})?)\s*$/.exec(line);
    if (!match?.[1]?.trim()) throw new Error(`Use a name and surcharge, for example “Extra cheese +2”, for: ${line}`);
    rows.push({ label: match[1].trim(), price_cents: Math.round(Number(match[2]) * 100) });
  }
  return rows.map((row, sort) => ({ ...row, sort }));
}

/** Draft modifiers stay in the parent draft until a manager publishes. */
export async function replaceModifiers(db: Db, itemId: string, modifiers: Row[]): Promise<void> {
  const previous = await db.list<Row>('menu_modifiers', { where: { item_id: itemId } });
  try {
    for (const row of previous) await db.remove('menu_modifiers', String(row.id));
    for (const row of modifiers) await db.insert('menu_modifiers', { ...row, id: crypto.randomUUID(), item_id: itemId });
  } catch (error) {
    // Recover the prior set after a failed write; the parent draft is retained.
    const partial = await db.list<Row>('menu_modifiers', { where: { item_id: itemId } });
    for (const row of partial) await db.remove('menu_modifiers', String(row.id));
    for (const row of previous) await db.insert('menu_modifiers', row);
    throw error;
  }
}
