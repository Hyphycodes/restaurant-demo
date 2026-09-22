import { ContractorForm } from '@/components/staff/manage/MoreForms';
import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Screen } from '@/components/staff/ui';
import { isDenied, staffPage } from '../../_lib';

export const dynamic = 'force-dynamic';

export default async function NewContractorPage() {
  const page = await staffPage('contractors.manage');
  if (isDenied(page)) return page.denied;
  const { context, unread } = page;
  return (
    <StaffShell context={context} unread={unread}>
      <Back href="/staff/contractors" label="Contractors" />
      <Screen title="Add a contractor">
        <ContractorForm contractor={null} />
      </Screen>
    </StaffShell>
  );
}
