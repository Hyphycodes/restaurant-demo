'use client';

import { sendSignInLink } from '@/server/actions/passwordless';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { Label, TextInput } from '@/components/admin/ui';
import { signIn, signInAs } from '@/server/actions/team';
import type { Role } from '@/server/permissions';

function PasswordForm({ next }: { next?: string }) {
  return (
    <ActionForm action={signIn} className="grid gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div>
        <Label htmlFor="email">Email</Label>
        <TextInput
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.invalid"
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <TextInput
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div>
        <SubmitButton>Sign in</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Development only — the server action refuses unless the local database is live. */
export function LocalSignIn({
  role,
  name,
  summary,
  next,
}: {
  role: Role;
  name: string;
  summary: string;
  /** Where to land after signing in, e.g. /staff. */
  next?: string;
}) {
  return (
    <ActionForm action={signInAs}>
      <input type="hidden" name="role" value={role} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <button
        type="submit"
        className="w-full rounded-(--radius-sm) border border-brown/25 bg-linen px-4 py-3 text-left transition-colors hover:border-coral hover:bg-coral/5"
      >
        <span className="block text-[0.9375rem] font-semibold text-brown">{name}</span>
        <span className="mt-0.5 block text-[0.8125rem] text-brown-soft">{summary}</span>
      </button>
    </ActionForm>
  );
}

export function LoginForm({ next }: { next?: string }) {
  return <div className="grid gap-6">
    <div><p className="mb-4 text-sm leading-relaxed text-brown-soft">Use your staff email. We’ll send a secure sign-in link—no password to remember.</p>
      <ActionForm action={sendSignInLink} className="grid gap-4">
        <div><Label htmlFor="staff-email">Email</Label><TextInput id="staff-email" name="email" type="email" autoComplete="email" required autoFocus placeholder="you@example.com" /></div>
        <SubmitButton>Email me a sign-in link</SubmitButton>
      </ActionForm>
    </div>
    <details className="border-t border-brown/20 pt-4"><summary className="min-h-11 cursor-pointer text-sm font-semibold text-brown">Use a password instead</summary><div className="mt-3"><PasswordForm next={next} /></div></details>
  </div>;
}
