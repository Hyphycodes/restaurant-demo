import { ActivateInvitation } from './ActivateInvitation';

export const metadata = { title: 'Finish signing in | Casa Aurelia', robots: { index: false, follow: false } };
export default function ActivatePage() {
  return <main className="mx-auto max-w-md px-6 py-24"><h1 className="display text-3xl">Welcome to Casa Aurelia</h1><ActivateInvitation /></main>;
}
