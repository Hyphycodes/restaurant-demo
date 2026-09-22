import { notFound } from 'next/navigation';
import { TemplateForm } from '@/components/staff/manage/MoreForms';
import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Screen } from '@/components/staff/ui';
import { getTemplate } from '@/server/staff/checklists';
import { listPositions } from '@/server/staff/employees';
import { isDenied, staffPage } from '../../../../_lib';

export const dynamic = 'force-dynamic';

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const page = await staffPage('checklists.manage');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const { id } = await params;
  const [template, positions] = await Promise.all([getTemplate(db, id), listPositions(db)]);
  if (!template) notFound();
  return (
    <StaffShell context={context} unread={unread}>
      <Back href="/staff/operations/checklists" label="Checklists" />
      <Screen title={template.title} lead="Editing the template changes future runs only; what was ticked last week stays as it was.">
        <TemplateForm template={template} locations={context.locations} positions={positions} />
      </Screen>
    </StaffShell>
  );
}
