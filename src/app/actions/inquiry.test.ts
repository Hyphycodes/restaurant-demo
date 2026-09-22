import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ configured: vi.fn(), client: vi.fn(), local: vi.fn(), db: vi.fn() }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': crypto.randomUUID() }) }));
vi.mock('@/lib/supabase/server', () => ({ isSupabaseConfigured: mocks.configured, getServiceClient: mocks.client }));
vi.mock('@/lib/db', () => ({ isLocalDb: mocks.local, getReadDb: mocks.db }));
import { submitInquiry } from './inquiry';
function form() { const data = new FormData(); Object.entries({name:'QA Test',email:'qa@example.com',phone:'3125550100',date:'2026-09-20',guests:'20',fulfillment:'pickup'}).forEach(([k,v])=>data.set(k,v)); return data; }
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-17T01:00:00Z')); mocks.local.mockReturnValue(false); mocks.configured.mockReturnValue(true); });
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
describe('inquiry delivery', () => {
  it('only confirms a successful database insert', async () => {
    const insert = vi.fn().mockResolvedValue({error:null}); mocks.client.mockReturnValue({from:()=>({insert})});
    expect((await submitInquiry('catering', form())).ok).toBe(true);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({type:'catering',status:'new'}));
  });
  it('fails honestly for unavailable storage', async () => {
    mocks.configured.mockReturnValue(false);
    const result = await submitInquiry('catering',form()); expect(result.ok).toBe(false);
  });
  it('fails honestly for rejected or disconnected inserts', async () => {
    mocks.client.mockReturnValue({from:()=>({insert:async()=>({error:{message:'unavailable'}})})});
    expect((await submitInquiry('catering',form())).ok).toBe(false);
    mocks.client.mockReturnValue({from:()=>({insert:async()=>{throw Error('offline')}})});
    expect((await submitInquiry('catering',form())).ok).toBe(false);
  });
  it('rejects the honeypot, impossible dates and past Chicago dates', async () => {
    const data=form(); data.set('company_website','bot'); expect((await submitInquiry('catering',data)).ok).toBe(false);
    data.delete('company_website'); data.set('date','2026-02-30'); expect((await submitInquiry('catering',data)).ok).toBe(false);
    data.set('date','2026-09-15'); expect((await submitInquiry('catering',data)).ok).toBe(false);
  });
});
