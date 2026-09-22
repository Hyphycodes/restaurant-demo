import StaffWelcome from '../../templates/staff/StaffWelcome';
import { staffWelcome } from '../../fixtures';

/** Preview: staff-ops/staff-welcome. Run `npm run email:dev` and open it in the sidebar. */
export default function StaffWelcomePreview() {
  return <StaffWelcome {...staffWelcome} />;
}
