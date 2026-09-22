import EventAssignment from '../../templates/staff/EventAssignment';
import { eventAssignment } from '../../fixtures';

/** Preview: staff-ops/event-assignment. Run `npm run email:dev` and open it in the sidebar. */
export default function EventAssignmentPreview() {
  return <EventAssignment {...eventAssignment} />;
}
