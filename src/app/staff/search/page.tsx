import { SearchField } from '@/components/admin/SearchField';
import { StaffShell } from '@/components/staff/StaffShell';
import { Empty, Pill, Row, Screen } from '@/components/staff/ui';
import { staffSearch } from '@/server/staff/search';
import { contextCan } from '@/server/staff/session';
import { isDenied, staffPage } from '../_lib';

export const dynamic = 'force-dynamic';

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const page = await staffPage('staff.view_team');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const { q } = await searchParams;
  // The scope is derived from the capability, not from the route, so the
  // same function cannot be reused somewhere looser and leak.
  const scope = contextCan(context, 'staff.view_team') ? 'team' : 'roster';
  const hits = q ? await staffSearch(db, q, scope) : [];
  return (
    <StaffShell context={context} unread={unread}>
      <Screen title="Search">
        <SearchField id="staff-search" name="q" label="People, phones, emails, positions, contractors, events" placeholder="Marco, 555-0102, bartender, vinyl…" initial={q ?? ''} basePath="/staff/search" />
        {q && hits.length === 0 ? <Empty title="No matches." detail="Try part of a name, a phone number or a position." /> : null}
        {hits.length > 0 ? (
          <div className="staff-panel px-4">
            {hits.map((hit) => (
              <Row key={`${hit.kind}-${hit.id}`} href={hit.href} title={hit.title} detail={hit.detail} trailing={<Pill>{hit.kind}</Pill>} />
            ))}
          </div>
        ) : null}
      </Screen>
    </StaffShell>
  );
}
