import { redirect } from 'next/navigation';
import { AdminShell, NoAccess } from '@/components/admin/AdminShell';
import { Card, HelpNote, LinkButton, Notice } from '@/components/admin/ui';
import { isLocalDb } from '@/lib/db';
import { getStaff } from '@/server/auth';
import { readiness, readinessSummary, type ReadinessItem } from '@/server/ticketing/readiness';

export const dynamic = 'force-dynamic';

/**
 * What is connected — the one page that answers "why can nobody buy a ticket?"
 *
 * It reports whether each key is present, never what any of them is. Owner
 * only, because a list of what is missing is a list of what to attack.
 */
export default async function SetupPage() {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');
  const local = isLocalDb();

  if (staff.role !== 'owner') {
    return (
      <AdminShell staff={staff} local={local} title="Setup">
        <NoAccess what="the setup checklist" />
      </AdminShell>
    );
  }

  const items = await readiness();
  const summary = readinessSummary(items);

  return (
    <AdminShell
      staff={staff}
      local={local}
      title="Setup"
      description="What the website is connected to, and what each missing piece stops."
    >
      <div className="grid gap-4">
        {summary.blocking.length === 0 ? (
          <Notice tone="success">Everything is connected. Tickets can be sold, emailed and scanned.</Notice>
        ) : (
          <Notice tone="warning">
            {summary.ready} of {summary.total} connected. Still to do: {summary.blocking.join(', ')}.
          </Notice>
        )}

        {items.map((item) => (
          <Item key={item.id} item={item} />
        ))}

        <Card title="Where these go" tone="quiet">
          <p className="text-[0.9375rem] leading-relaxed text-brown">
            Every value lives in Vercel → your project → Settings → Environment Variables, set for
            Production (and Preview, if you want the preview links to work too). Adding one needs a
            redeploy before it takes effect. Nothing secret is ever stored in the website&rsquo;s code.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <LinkButton href="https://vercel.com/dashboard" external>
              Open Vercel
            </LinkButton>
            <LinkButton href="https://supabase.com/dashboard" external>
              Open Supabase
            </LinkButton>
            <LinkButton href="https://dashboard.stripe.com" external>
              Open Stripe
            </LinkButton>
          </div>
          <HelpNote>
            This page never shows a key, only whether one is there. If something says it is missing
            and you know you added it, the deployment probably predates the change — redeploy.
          </HelpNote>
        </Card>
      </div>
    </AdminShell>
  );
}

const CHIP: Record<ReadinessItem['state'], { label: string; className: string }> = {
  ready: { label: 'Connected', className: 'border-success/60 bg-success/10 text-success' },
  partial: { label: 'Partly', className: 'border-warning/60 bg-warning/10 text-warning' },
  missing: { label: 'Not connected', className: 'border-danger/60 bg-danger/10 text-danger' },
};

function Item({ item }: { item: ReadinessItem }) {
  const chip = CHIP[item.state];
  return (
    <Card
      title={item.title}
      action={
        <span
          className={`inline-flex items-center rounded-(--radius-sm) border px-2.5 py-1 text-[0.75rem] font-semibold uppercase tracking-[0.08em] ${chip.className}`}
        >
          {chip.label}
        </span>
      }
    >
      <p className="text-[0.9375rem] leading-relaxed text-brown">{item.consequence}</p>
      {item.detail ? <p className="mt-2 text-[0.875rem] text-brown-soft">{item.detail}</p> : null}

      {item.vars.length > 0 ? (
        <ul className="mt-4 grid gap-1.5">
          {item.vars.map((entry) => (
            <li key={entry.name} className="flex items-center gap-2 text-[0.875rem] text-brown">
              <span aria-hidden="true" className={entry.set ? 'text-success' : 'text-danger'}>
                {entry.set ? '✓' : '✗'}
              </span>
              <code className="tabular">{entry.name}</code>
              <span className="sr-only">{entry.set ? 'is set' : 'is not set'}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {item.steps.length > 0 ? (
        <ol className="mt-4 grid list-decimal gap-1.5 pl-5 text-[0.9375rem] leading-relaxed text-brown-soft">
          {item.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}
    </Card>
  );
}
