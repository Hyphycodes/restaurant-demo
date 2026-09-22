import { TemplateForm } from '@/components/staff/manage/MoreForms';
import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Screen } from '@/components/staff/ui';
import { listPositions } from '@/server/staff/employees';
import { isDenied, staffPage } from '../../../../_lib';

export const dynamic = 'force-dynamic';

export default async function NewTemplatePage() {
  const page = await staffPage('checklists.manage');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const positions = await listPositions(db);
  return (
    <StaffShell context={context} unread={unread}>
      <Back href="/staff/operations/checklists" label="Checklists" />
      <Screen title="New checklist">
        <TemplateForm template={null} locations={context.locations} positions={positions} />
      </Screen>
    </StaffShell>
  );
}
