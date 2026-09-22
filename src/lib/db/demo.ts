import 'server-only';
import { cookies } from 'next/headers';
import { buildDemoRecords } from '@/server/demo-records';
import { PRIMARY_KEY, primaryKey, type Db, type ListOptions, type Row } from './types';
import { decodeDemoChanges, encodeDemoChanges, DEMO_STATE_PREFIX, DEMO_STATE_CHUNKS, DEMO_STATE_CHUNK_SIZE, type DemoChanges } from './demo-state';

type Jar = Awaited<ReturnType<typeof cookies>>;
const queues = new WeakMap<Jar, Promise<unknown>>();
function readChanges(jar:Jar):DemoChanges {
  return decodeDemoChanges(Array.from({length:DEMO_STATE_CHUNKS},(_,i)=>jar.get(`${DEMO_STATE_PREFIX}${i}`)?.value??'').join(''));
}
function rowsFor(table:string,changes:DemoChanges):Row[] {
  const key=primaryKey(table);
  const rows=new Map((buildDemoRecords()[table]??[]).map(row=>[String(row[key]),row]));
  for(const [id,row] of Object.entries(changes[table]??{})){if(row===null)rows.delete(id);else rows.set(id,row);}
  return [...rows.values()];
}

/** Small browser-scoped overrides survive serverless routing and cold starts.
 * No shared store or service credentials. Only mutations can set these HttpOnly cookies.
 * The data is intentionally untrusted: it affects only this visitor's fictional demo.
 */
export class DemoDb implements Db {
  readonly kind='local' as const;
  private async rows(table:string):Promise<Row[]> {
    let changes:DemoChanges={};
    try {const jar=await cookies();await queues.get(jar);changes=readChanges(jar);} catch { /* Build-time reads are fictional defaults. */ }
    return rowsFor(table,changes);
  }
  async list<T extends Row>(table:string,options:ListOptions={}):Promise<T[]> {
    let rows=await this.rows(table) as T[];
    for(const [column,value] of Object.entries(options.where??{}))rows=rows.filter(row=>value===null?row[column]==null:row[column]===value);
    for(const [column,values] of Object.entries(options.whereIn??{}))rows=rows.filter(row=>new Set<unknown>(values).has(row[column]));
    if(options.range){const {column,from,to}=options.range;rows=rows.filter(row=>row[column]!=null&&(from===undefined||String(row[column])>=from)&&(to===undefined||String(row[column])<to));}
    if(options.orderBy){const key=options.orderBy;rows.sort((a,b)=>a[key]===b[key]?0:a[key]==null?1:b[key]==null?-1:a[key]!<b[key]!?-1:1);if(options.desc)rows.reverse();}
    return typeof options.limit==='number'?rows.slice(0,options.limit):rows;
  }
  async get<T extends Row>(table:string,id:string):Promise<T|null>{const key=primaryKey(table);return ((await this.rows(table)).find(row=>row[key]===id) as T|undefined)??null;}
  private async write<T>(table:string,id:string,job:(previous:Row|null)=>Row|null):Promise<T> {
    if(!Object.hasOwn(PRIMARY_KEY,table)||['__proto__','constructor','prototype'].includes(id))throw new Error('Invalid demo record.');
    const jar=await cookies();
    const next=(queues.get(jar)??Promise.resolve()).then(()=>{
      const changes=readChanges(jar);const key=primaryKey(table);
      const previous=rowsFor(table,changes).find(row=>row[key]===id)??null;
      const row=job(previous);(changes[table]??=Object.create(null))[id]=row;
      const encoded=encodeDemoChanges(changes);
      for(let i=0;i<DEMO_STATE_CHUNKS;i++)jar.set(`${DEMO_STATE_PREFIX}${i}`,encoded.slice(i*DEMO_STATE_CHUNK_SIZE,(i+1)*DEMO_STATE_CHUNK_SIZE),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:3600});
      return row as T;
    });
    queues.set(jar,next.catch(()=>undefined));return next;
  }
  async insert<T extends Row>(table:string,row:Row):Promise<T>{const key=primaryKey(table);const id=String(row[key]??crypto.randomUUID());return this.write<T>(table,id,previous=>{if(previous)throw new Error('That demo record already exists.');return {...row,[key]:id,updated_at:new Date().toISOString()};});}
  async update<T extends Row>(table:string,id:string,patch:Row):Promise<T>{return this.write<T>(table,id,previous=>{if(!previous)throw new Error('That demo record was not found.');return {...previous,...patch,[primaryKey(table)]:id,updated_at:new Date().toISOString()};});}
  async upsert<T extends Row>(table:string,row:Row):Promise<T>{const key=primaryKey(table);const id=String(row[key]??crypto.randomUUID());return this.write<T>(table,id,previous=>({...previous,...row,[key]:id,updated_at:new Date().toISOString()}));}
  async remove(table:string,id:string):Promise<void>{await this.write(table,id,()=>null);}
}
