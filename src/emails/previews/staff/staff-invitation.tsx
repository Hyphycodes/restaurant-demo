import StaffInvitation from '../../templates/StaffInvitation';
import { staffInvitation } from '../../fixtures';

/** Preview: staff/staff-invitation. Run `npm run email:dev` and open it in the sidebar. */
export default function StaffInvitationPreview() {
  return <StaffInvitation {...staffInvitation} />;
}
