import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalDb } from '@/lib/db/local';
import { buildRecords } from '@/server/migration/records';
import type { Row } from '@/lib/db/types';
import { getPublicEvents } from '@/server/content/events';
import { getPublicMenus } from '@/server/content/menu';
import { publishDraft } from '@/server/content/editorial';
import { parseModifiers } from '@/server/content/modifiers';
const context = vi.hoisted(() => ({ db: null as unknown, staff: { id:'qa-manager', name:'QA', email:'qa@example.com', role:'admin', sections:[], active:true, source:'local' } }));
vi.mock('@/lib/db',()=>({getReadDb:()=>context.db, getWriteDb:async()=>context.db}));
vi.mock('@/server/auth',()=>({requireCapability:async()=>context.staff,staffCan:()=>true}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
import { addCategory, addMenuItem, saveMenuItem } from './menu';
import { createOneTimeEvent, duplicateEvent, saveOccurrence, createSeries } from './events';
const idle={ok:true,message:''};
let directory:string;
let db:LocalDb;
const fd=(data:Record<string,string>)=>{const form=new FormData();for(const [key,value] of Object.entries(data))form.set(key,value);return form;};
beforeEach(async()=>{directory=await mkdtemp(path.join(tmpdir(),'cosa-nostra-action-'));db=new LocalDb(directory,()=>buildRecords().tables);context.db=db;});
afterEach(async()=>{await rm(directory,{recursive:true,force:true});});
describe('staff workflows',()=>{
  it('creates a category and keeps unfinished dishes hidden',async()=>{
    expect((await addCategory(idle,fd({menuSlug:'cocktails',name:'QA category'}))).ok).toBe(true);
    const category=(await db.list<Row>('menu_categories')).find(r=>r.name==='QA category')!;
    expect((await addMenuItem(idle,fd({categoryId:String(category.id),name:'QA dish'}))).ok).toBe(true);
    const cocktails=(await getPublicMenus()).find(m=>m.slug==='cocktails')!;
    expect(cocktails.categories.flatMap(c=>c.items).find(i=>i.name==='QA dish')).toBeUndefined();
  });
  it('stores one-off drafts and duplicates without reusing tickets',async()=>{
    expect((await createOneTimeEvent(idle,fd({title:'QA special',date:'2026-10-02',startTime:'22:00',endTime:'02:00',description:'QA only',ageMin:'18',music:'House',price:'10',ticketUrl:'https://example.com/ticket',publish:'false'}))).ok).toBe(true);
    const event=(await db.list<Row>('event_occurrences')).find(r=>r.title==='QA special')!;
    expect(Date.parse(String(event.ends_at))-Date.parse(String(event.starts_at))).toBe(4*3600000);
    expect((await duplicateEvent(idle,fd({id:String(event.id)}))).ok).toBe(true);
    const copy=(await db.list<Row>('event_occurrences')).find(r=>r.title==='QA special (copy)')!;
    expect(copy.published).toBe(false);expect(copy.ticket_url).toBeNull();
  });
  it('creates repeating nights paused and applies UTC overrides to the right night',async()=>{
    expect((await createSeries(idle,fd({title:'QA weekly',weekday:'4',startTime:'22:00',endTime:'02:00'}))).ok).toBe(true);
    expect((await db.list<Row>('event_series')).find(r=>r.title==='QA weekly')!.paused).toBe(true);
    expect((await saveOccurrence(idle,fd({seriesSlug:'after-hours-friday',date:'2026-09-18',status:'cancelled',ticketUrl:'',price:'',flyerAssetId:'',title:'',note:''}))).ok).toBe(true);
    const override=(await db.list<Row>('event_occurrences')).find(r=>r.series_slug==='after-hours-friday')!;
    expect(override.starts_at).toBe('2026-09-19T03:00:00.000Z');
    expect(Date.parse(String(override.ends_at))).toBeGreaterThan(Date.parse(String(override.starts_at)));
  });
  it('does not resurrect static events when all series have been removed',async()=>{
    for(const row of await db.list<Row>('event_series')) await db.remove('event_series',String(row.slug));
    expect((await getPublicEvents()).series).toEqual([]);
  });
  it('keeps add-on changes private until publishing the item draft',async()=>{
    const before=(await db.list<Row>('menu_modifiers',{where:{item_id:'sunday-meatballs'}}));
    expect((await saveMenuItem(idle,fd({id:'sunday-meatballs',name:'Sunday Meatballs',description:'Test draft',categoryId:'antipasti',mode:'fixed',amount:'12',availability:'available',modifierGroupLabel:'Sauce',choices:'QA sauce',addOns:'QA cheese +2.50',dietary:'',publish:'false'}))).ok).toBe(true);
    expect(await db.list<Row>('menu_modifiers',{where:{item_id:'sunday-meatballs'}})).toEqual(before);
    await publishDraft(db,'menu_items','sunday-meatballs',context.staff as never);
    const after=await db.list<Row>('menu_modifiers',{where:{item_id:'sunday-meatballs'}});
    expect(after.map(r=>[r.label,r.price_cents])).toEqual([['QA sauce',null],['QA cheese',250]]);
    expect((await db.get<Row>('menu_items','sunday-meatballs'))!._modifiers).toBeUndefined();
    expect(()=>parseModifiers('', 'Extra cheese without price')).toThrow(/surcharge/);
  });
});
