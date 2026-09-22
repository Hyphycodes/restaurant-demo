import {beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({user:vi.fn(),profile:vi.fn(),complete:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({getServiceClient:()=>({}),getSessionClient:async()=>({auth:{getUser:mocks.user},from:()=>({select:()=>({eq:()=>({maybeSingle:mocks.profile})})})})}));
vi.mock('../owner-onboarding',()=>({INITIAL_OWNER_EMAIL:'owner@example.invalid',normalizeEmail:(s:string)=>s,findAuthUser:vi.fn(),completeOwnerOnboarding:mocks.complete}));
import {finishInvitation} from './passwordless';
beforeEach(()=>{vi.clearAllMocks();mocks.user.mockResolvedValue({data:{user:{id:'staff',email_confirmed_at:'2026-09-17'}},error:null});mocks.profile.mockResolvedValue({data:{active:true},error:null});mocks.complete.mockResolvedValue(undefined);});
describe('invitation completion',()=>{
 it('rejects missing provider session',async()=>{mocks.user.mockResolvedValue({data:{user:null},error:null});expect((await finishInvitation()).ok).toBe(false);expect(mocks.complete).not.toHaveBeenCalled();});
 it('rejects unverified identity',async()=>{mocks.user.mockResolvedValue({data:{user:{id:'staff'}},error:null});expect((await finishInvitation()).ok).toBe(false);expect(mocks.complete).not.toHaveBeenCalled();});
 it('rejects inactive profiles',async()=>{mocks.profile.mockResolvedValue({data:{active:false},error:null});expect((await finishInvitation()).ok).toBe(false);});
 it('rejects missing staff profiles',async()=>{mocks.profile.mockResolvedValue({data:null,error:null});expect((await finishInvitation()).ok).toBe(false);});
 it('fails closed when owner setup fails',async()=>{mocks.complete.mockRejectedValue(new Error('database'));expect((await finishInvitation()).ok).toBe(false);});
 it('accepts verified active staff',async()=>{expect((await finishInvitation()).ok).toBe(true);});
});
