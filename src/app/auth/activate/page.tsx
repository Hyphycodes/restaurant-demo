import { ActivateInvitation } from './ActivateInvitation';

export const metadata = { title: 'Finish signing in | Cosa Nostra', robots: { index: false, follow: false } };
export default function ActivatePage() {
  return <main className="mx-auto max-w-md px-6 py-24"><h1 className="display text-3xl">Welcome to Cosa Nostra</h1><ActivateInvitation /></main>;
}
