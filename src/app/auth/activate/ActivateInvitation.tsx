'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { finishInvitation } from '@/server/actions/passwordless';

export function ActivateInvitation() {
  const started = useRef(false);
  const [message, setMessage] = useState('Finishing your secure sign-in…');
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    // Remove credentials from the address bar before any navigation or rendering.
    window.history.replaceState(null, '', window.location.pathname);
    async function activate() {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key || !access_token || !refresh_token) throw new Error('invalid');
      const client = createBrowserClient(url, key, {auth:{detectSessionInUrl:false}});
      const {error} = await client.auth.setSession({access_token,refresh_token});
      if (error) throw error;
      const result = await finishInvitation();
      if (!result.ok) { await client.auth.signOut(); throw new Error('access'); }
      window.location.replace('/admin');
    }
    void activate().catch(() => setMessage('This invitation could not be completed. Request a fresh link from the sign-in page.'));
  }, []);
  return <><p className="mt-4" role="status">{message}</p><Link href="/admin/login" className="mt-6 inline-block underline">Back to sign in</Link></>;
}
