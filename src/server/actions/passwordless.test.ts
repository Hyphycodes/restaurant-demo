import {beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({find:vi.fn(),send:vi.fn(),create:vi.fn(),invite:vi.fn(),maybe:vi.fn(),limit:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({getServiceClient:()=>({auth:{admin:{createUser:mocks.create,inviteUserByEmail:mocks.invite}},from:()=>({select:()=>({eq:()=>({maybeSingle:mocks.maybe,limit:mocks.limit})})})}),getSessionClient:async()=>({auth:{signInWithOtp:mocks.send}})}));
vi.mock('../owner-onboarding',()=>({INITIAL_OWNER_EMAIL:'owner@example.invalid',normalizeEmail:(s:string)=>s.trim().toLowerCase(),findAuthUser:mocks.find}));
import {sendSignInLink} from './passwordless';
const idle={ok:true,message:''};
function form(email:string){const data=new FormData();data.set('email',email);return data;}
beforeEach(()=>{vi.clearAllMocks();mocks.find.mockResolvedValue({id:'staff',email_confirmed_at:'2026-09-17'});mocks.maybe.mockResolvedValue({data:{active:true},error:null});mocks.limit.mockResolvedValue({data:[],error:null});mocks.send.mockResolvedValue({error:null});mocks.invite.mockResolvedValue({error:null});});
describe('passwordless staff sign-in',()=>{
 it('does not create or email unknown non-staff addresses',async()=>{mocks.find.mockResolvedValue(null);expect((await sendSignInLink(idle,form('unknown@example.com'))).ok).toBe(true);expect(mocks.send).not.toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled();});
 it('does not send links to disabled staff',async()=>{mocks.maybe.mockResolvedValue({data:{active:false},error:null});await sendSignInLink(idle,form('staff@example.com'));expect(mocks.send).not.toHaveBeenCalled();});
 it('requires an existing active profile for ordinary staff',async()=>{mocks.maybe.mockResolvedValue({data:null,error:null});await sendSignInLink(idle,form('staff@example.com'));expect(mocks.send).not.toHaveBeenCalled();});
 it('uses an exact callback and never allows OTP self-signup',async()=>{await sendSignInLink(idle,form('Staff@example.com'));expect(mocks.send).toHaveBeenCalledWith({email:'staff@example.com',options:{shouldCreateUser:false,emailRedirectTo:expect.stringMatching(/\/auth\/callback$/)}});});
 it('invites unconfirmed staff without enabling public signup',async()=>{mocks.find.mockResolvedValue({id:'staff'});await sendSignInLink(idle,form('staff@example.com'));expect(mocks.invite).toHaveBeenCalledWith('staff@example.com',{redirectTo:expect.stringMatching(/\/auth\/activate$/)});expect(mocks.send).not.toHaveBeenCalled();});
 it('reports actual email service failures',async()=>{mocks.send.mockResolvedValue({error:{message:'rate limit'}});expect((await sendSignInLink(idle,form('staff@example.com'))).ok).toBe(false);});
 it('does not bootstrap once an owner exists',async()=>{mocks.find.mockResolvedValue(null);mocks.limit.mockResolvedValue({data:[{user_id:'owner'}],error:null});await sendSignInLink(idle,form('owner@example.invalid'));expect(mocks.create).not.toHaveBeenCalled();});
 it('only creates an unverified initial identity',async()=>{mocks.find.mockResolvedValue(null);mocks.create.mockResolvedValue({data:{user:{id:'new'}},error:null});await sendSignInLink(idle,form('owner@example.invalid'));expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({email_confirm:false,email:'owner@example.invalid'}));});
});
