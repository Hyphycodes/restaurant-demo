import { RequirementTypeForm } from '@/components/staff/manage/MoreForms';
import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Pill, Screen, Section } from '@/components/staff/ui';
import { listPositions } from '@/server/staff/employees';
import { listRequirementTypes } from '@/server/staff/requirements';
import { listModules } from '@/server/staff/training';
import { isDenied, staffPage } from '../../../_lib';

export const dynamic = 'force-dynamic';


export default async function RequirementTypesPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const page = await staffPage('documents.manage');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const { edit } = await searchParams;
  const [types, positions, modules] = await Promise.all([listRequirementTypes(db, { includeInactive: true }), listPositions(db), listModules(db, { includeDrafts: true })]);
  const editing = edit ? types.find((type) => type.id === edit) ?? null : null;
  return (
    <StaffShell context={context} unread={unread} wide>
      <Back href="/staff/operations/documents" label="Documents" />
      <Screen title="Requirements" lead="Documents, policies, certifications and onboarding steps. Each is a slot Casa Aurelia fills with its own form, link or policy — nothing here decides what the law requires.">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Section title="Configured" count={types.length}>
            <div className="staff-panel px-4">
              {types.map((type) => (
                <a key={type.id} href={`/staff/operations/documents/types?edit=${type.id}`} className="staff-row -mx-1 px-1">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.9375rem] font-semibold text-brown">{type.title}</span>
                    <span className="block text-[0.8125rem] text-brown-soft">
                      {type.kind.replace('_', ' ')} · {type.category}
                      {type.appliesToPositions.length ? ` · ${type.appliesToPositions.join(', ')}` : ' · everyone'}
                      {type.expiresAfterDays ? ` · expires after ${type.expiresAfterDays} days` : ''}
                    </span>
                  </span>
                  <span className="flex gap-1">
                    {type.required ? <Pill tone="accent">Required</Pill> : <Pill>Optional</Pill>}
                    {type.onboarding ? <Pill>Onboarding</Pill> : null}
                    {!type.active ? <Pill tone="bad">Retired</Pill> : null}
                  </span>
                </a>
              ))}
            </div>
          </Section>
          <Section title={editing ? `Edit: ${editing.title}` : 'Add a requirement'} action={editing ? <a href="/staff/operations/documents/types" className="text-[0.8125rem] font-semibold text-brown-soft underline underline-offset-4">New instead</a> : undefined}>
            <div className="staff-panel px-4 py-4">
              {editing?.kind === 'system' ? <p className="text-[0.875rem] text-brown-soft">This one is built in (it checks the profile itself). You can retire it or change who it applies to.</p> : null}
              <RequirementTypeForm key={editing?.id ?? 'new'} type={editing} positions={positions} locations={context.locations} modules={modules} />
            </div>
          </Section>
        </div>
      </Screen>
    </StaffShell>
  );
}
