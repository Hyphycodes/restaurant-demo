import { afterEach,describe,expect,it,vi } from 'vitest';
import { DEMO_MODE } from './demo';
import { getStripe,isStripeConfigured,getWebhookSecret } from './stripe';
import { getServiceClient,getSessionClient,isSupabaseConfigured } from './supabase/server';
import { resendTransport } from '@/server/email/transport';
import { emailConfig } from '@/server/email/config';
import { getTicketingClient } from '@/server/ticketing/db';

afterEach(()=>vi.unstubAllEnvs());
describe('permanent portfolio service isolation',()=>{
 it('cannot be switched off by a deployment variable',()=>{vi.stubEnv('DEMO_MODE','false');expect(DEMO_MODE).toBe(true);});
 it('refuses Stripe even if credentials are accidentally supplied',()=>{
   vi.stubEnv('STRIPE_SECRET_KEY','sk_test_fictional');vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY','pk_test_fictional');vi.stubEnv('STRIPE_WEBHOOK_SECRET','whsec_fictional');
   expect(getStripe()).toBeNull();expect(isStripeConfigured()).toBe(false);expect(getWebhookSecret()).toBeNull();
 });
 it('refuses both database privilege levels',async()=>{vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://demo.invalid');vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','fictional');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','fictional');expect(isSupabaseConfigured()).toBe(false);expect(getServiceClient()).toBeNull();expect(await getSessionClient()).toBeNull();expect(getTicketingClient()).toBeNull();});
 it('cannot deliver email even when delivery is requested',()=>{vi.stubEnv('RESEND_API_KEY','re_fictional');vi.stubEnv('EMAIL_DELIVERY_ENABLED','true');expect(resendTransport()).toBeNull();expect(emailConfig().transportConfigured).toBe(false);expect(emailConfig().deliveryEnabled).toBe(false);});
});
