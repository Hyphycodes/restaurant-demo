'use client';

import { useState, type FormEvent } from 'react';
import type { LinkHubBlock } from '@/features/link-hubs/types';
import styles from './LinkHub.module.css';

export function LeadCapture({ hubId, block, preview = false }: { hubId: string; block: LinkHubBlock; preview?: boolean }) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (preview) {
      setStatus('done');
      setMessage('Preview only — no lead was stored.');
      return;
    }
    setStatus('saving');
    const form = new FormData(formElement);
    const response = await fetch('/api/link-hubs/leads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        hubId,
        blockId: block.id,
        name: form.get('name'),
        email: form.get('email'),
        phone: form.get('phone'),
        birthday: form.get('birthday'),
        company: form.get('company'),
        utm: Object.fromEntries(new URLSearchParams(location.search)),
      }),
    });
    const result = await response.json().catch(() => ({ message: 'Please try again.' })) as { message?: string };
    if (!response.ok) {
      setStatus('error');
      setMessage(result.message ?? 'Please try again.');
      return;
    }
    formElement.reset();
    setStatus('done');
    setMessage(block.config.successMessage || 'You’re on the list.');
  }

  return (
    <form className={styles.lead} onSubmit={submit}>
      <div>
        <p className={styles.blockEyebrow}>Stay in the loop</p>
        <h2>{block.config.title || 'Join the Cosa Nostra list'}</h2>
        {block.config.subtitle ? <p>{block.config.subtitle}</p> : null}
      </div>
      <div className={styles.leadGrid}>
        <label><span>Name</span><input name="name" autoComplete="name" required maxLength={100} /></label>
        <label><span>Email</span><input name="email" type="email" autoComplete="email" required maxLength={320} /></label>
        {block.config.collectPhone ? <label><span>Phone</span><input name="phone" type="tel" autoComplete="tel" maxLength={40} /></label> : null}
        {block.config.collectBirthday ? <label><span>Birthday</span><input name="birthday" type="date" /></label> : null}
        <label className={styles.honeypot} aria-hidden="true"><span>Company</span><input name="company" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <button type="submit" disabled={status === 'saving'}>{status === 'saving' ? 'Joining…' : 'Join the list'}</button>
      {message ? <p role="status" className={status === 'error' ? styles.formError : styles.formMessage}>{message}</p> : null}
    </form>
  );
}
