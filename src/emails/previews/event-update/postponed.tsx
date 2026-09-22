import EventUpdate from '../../templates/EventUpdate';
import { postponed } from '../../fixtures';

/** Preview: event-update/postponed. Run `npm run email:dev` and open it in the sidebar. */
export default function PostponedPreview() {
  return <EventUpdate {...postponed} />;
}
