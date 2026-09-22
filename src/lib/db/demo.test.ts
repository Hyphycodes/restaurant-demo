import { beforeEach, describe, expect, it, vi } from 'vitest';
const context=vi.hoisted(()=>({jar:{get:(name:string):{value:string}|undefined=>{void name;return undefined;},set:(name:string,value:string)=>{void name;void value;}}}));
vi.mock('next/headers',()=>({cookies:async()=>context.jar}));
import { DemoDb } from './demo';
import { decodeDemoChanges,encodeDemoChanges } from './demo-state';
function newJar(){const values=new Map<string,string>();return {get:(name:string)=>values.has(name)?{value:values.get(name)!}:undefined,set:(name:string,value:string)=>{values.set(name,value);}};}
beforeEach(()=>{context.jar=newJar();});
describe('browser-scoped serverless demo storage',()=>{
 it('keeps edits across fresh adapter instances and published reads',async()=>{
  await new DemoDb().update('menu_items','spicy-rigatoni',{name:'My demonstration pasta'});
  expect((await new DemoDb().get('menu_items','spicy-rigatoni'))?.name).toBe('My demonstration pasta');
 });
 it('isolates two visitors even when the same server serves them',async()=>{
  const first=context.jar;await new DemoDb().update('menu_items','spicy-rigatoni',{name:'Private sample'});
  context.jar=newJar();expect((await new DemoDb().get('menu_items','spicy-rigatoni'))?.name).toBe('Spicy Rigatoni');
  context.jar=first;expect((await new DemoDb().get('menu_items','spicy-rigatoni'))?.name).toBe('Private sample');
 });
 it('serializes concurrent changes within an action',async()=>{
  const db=new DemoDb();await Promise.all([db.update('menu_items','spicy-rigatoni',{name:'First change'}),db.update('menu_items','burrata',{name:'Second change'})]);
  expect((await db.get('menu_items','spicy-rigatoni'))?.name).toBe('First change');expect((await db.get('menu_items','burrata'))?.name).toBe('Second change');
 });
 it('supports the single appearance record across instances',async()=>{await new DemoDb().upsert('appearance',{id:1,preset:'daylight'});expect(await new DemoDb().list('appearance')).toMatchObject([{preset:'daylight'}]);});
 it('preserves inserts and removals across instances',async()=>{
  await new DemoDb().insert('inquiries',{id:'new-demo',name:'Fictional Guest'});await new DemoDb().remove('menu_items','burrata');
  expect(await new DemoDb().get('inquiries','new-demo')).toMatchObject({name:'Fictional Guest'});expect(await new DemoDb().get('menu_items','burrata')).toBeNull();
 });
 it('resets malformed or oversized browser state safely',()=>{expect(decodeDemoChanges('not-compressed')).toEqual({});expect(decodeDemoChanges('x'.repeat(10000))).toEqual({});});
 it('rejects state exceeding the demo budget before setting cookies',()=>{expect(()=>encodeDemoChanges({menu_items:{demo:{text:'x'.repeat(260000)}}})).toThrow('workspace is full');});
});
