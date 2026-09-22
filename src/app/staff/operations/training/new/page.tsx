import { ModuleForm } from '@/components/staff/manage/ModuleForm';
import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Screen } from '@/components/staff/ui';
import { listPositions } from '@/server/staff/employees';
import { isDenied, staffPage } from '../../../_lib';

export const dynamic = 'force-dynamic';

export default async function NewModulePage() {
  const page = await staffPage('training.manage');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const positions = await listPositions(db);
  return (
    <StaffShell context={context} unread={unread} wide>
      <Back href="/staff/operations/training" label="Training" />
      <Screen title="New module" lead="Sections in order, then an optional quiz. Save as a draft until it reads right.">
        <ModuleForm id={null} initial={null} positions={positions.filter((position) => position.active)} locations={context.locations} />
      </Screen>
    </StaffShell>
  );
}
