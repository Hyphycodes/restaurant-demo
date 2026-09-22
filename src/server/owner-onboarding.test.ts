import {describe,it,expect,vi} from 'vitest';
import type {SupabaseClient,User} from '@supabase/supabase-js';
import {completeOwnerOnboarding,INITIAL_OWNER_EMAIL,findAuthUser} from './owner-onboarding';

function client(profile: unknown = {role:'editor',active:true}, owners: unknown[] = [], fail=false) {
  const upsert=vi.fn().mockResolvedValue({error:null});
  const chain={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:profile,error:fail?{}:null}),limit:vi.fn().mockResolvedValue({data:owners,error:null}),upsert};
  return {db:{from:vi.fn(()=>chain)} as unknown as SupabaseClient,upsert};
}
const user={id:'verified-user',email:INITIAL_OWNER_EMAIL,email_confirmed_at:'2026-09-17T12:00:00Z'} as User;
describe('owner email onboarding',()=>{
  it('grants the first owner only after verified mailbox ownership',async()=>{const {db,upsert}=client();await completeOwnerOnboarding(db,user);expect(upsert).toHaveBeenCalledWith(expect.objectContaining({user_id:user.id,role:'owner'}),{onConflict:'user_id'});});
  it.each([{...user,email:'someone@example.com'},{...user,email_confirmed_at:undefined}])('does not elevate a different or unverified identity',async candidate=>{const {db,upsert}=client();await completeOwnerOnboarding(db,candidate);expect(upsert).not.toHaveBeenCalled();expect(db.from).not.toHaveBeenCalled();});
  it('does not reactivate revoked access',async()=>{const {db,upsert}=client({role:'editor',active:false});await completeOwnerOnboarding(db,user);expect(upsert).not.toHaveBeenCalled();});
  it('does not replace an existing owner',async()=>{const {db,upsert}=client(undefined,[{user_id:'other-owner'}]);await completeOwnerOnboarding(db,user);expect(upsert).not.toHaveBeenCalled();});
  it('fails closed on database errors',async()=>{const {db,upsert}=client(undefined,[],true);await expect(completeOwnerOnboarding(db,user)).rejects.toThrow();expect(upsert).not.toHaveBeenCalled();});
  it('normalizes mailbox addresses without accepting lookalikes',async()=>{const db={auth:{admin:{listUsers:vi.fn().mockResolvedValue({data:{users:[user]},error:null})}}} as unknown as SupabaseClient;expect(await findAuthUser(db,' owner@example.invalid ')).toBe(user);expect(await findAuthUser(db,'owner@example.invalid.attacker.test')).toBeNull();});
});
