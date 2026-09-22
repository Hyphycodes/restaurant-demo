import { notFound } from 'next/navigation';
import { ModuleForm } from '@/components/staff/manage/ModuleForm';
import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Screen } from '@/components/staff/ui';
import { listPositions } from '@/server/staff/employees';
import { moduleInputFor } from '@/server/staff/training';
import { isDenied, staffPage } from '../../../../_lib';

export const dynamic = 'force-dynamic';

export default async function EditModulePage({ params }: { params: Promise<{ id: string }> }) {
  const page = await staffPage('training.manage');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const { id } = await params;
  const [initial, positions] = await Promise.all([moduleInputFor(db, id), listPositions(db)]);
  if (!initial) notFound();
  return (
    <StaffShell context={context} unread={unread} wide>
      <Back href={`/staff/operations/training/${id}`} label={initial.title} />
      <Screen title={`Edit: ${initial.title}`} lead="A small fix is just a save. A material change — new procedure, new answers — is a new version: tick the box at the bottom and everyone who completed it is asked again.">
        <ModuleForm id={id} initial={initial} positions={positions.filter((position) => position.active)} locations={context.locations} />
      </Screen>
    </StaffShell>
  );
}
