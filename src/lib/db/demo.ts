import 'server-only';
import { cookies } from 'next/headers';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DEMO_SESSION_COOKIE } from '@/lib/demo';
import { buildDemoRecords } from '@/server/demo-records';
import { LocalDb } from './local';
import type { Db, ListOptions, Row } from './types';

/** Each visitor gets a separate ephemeral workspace. Never writes to the deployed source tree. */
const databases = new Map<string, LocalDb>();
export class DemoDb implements Db {
  readonly kind = 'local' as const;
  private async database(): Promise<LocalDb> {
    let session = 'public';
    try { session = (await cookies()).get(DEMO_SESSION_COOKIE)?.value ?? session; } catch { /* Build-time reads use only fictional seed data. */ }
    if (!/^[a-zA-Z0-9-]{1,64}$/.test(session)) session = 'public';
    let db=databases.get(session);
    if(!db){
      if(databases.size>100) databases.delete(databases.keys().next().value!);
      db=new LocalDb(path.join(tmpdir(), 'cn-demo-v5', session), () => buildDemoRecords());
      databases.set(session,db);
    }
    return db;
  }
  async list<T extends Row>(table: string, options?: ListOptions) { return (await this.database()).list<T>(table,options); }
  async get<T extends Row>(table: string,id: string) { return (await this.database()).get<T>(table,id); }
  async insert<T extends Row>(table: string,row: Row) { return (await this.database()).insert<T>(table,row); }
  async update<T extends Row>(table: string,id: string,row: Row) { return (await this.database()).update<T>(table,id,row); }
  async upsert<T extends Row>(table: string,row: Row) { return (await this.database()).upsert<T>(table,row); }
  async remove(table: string,id: string) { return (await this.database()).remove(table,id); }
}
