import EventUpdate from '../../templates/EventUpdate';
import { dateChange } from '../../fixtures';

/** Preview: event-update/date-change. Run `npm run email:dev` and open it in the sidebar. */
export default function DateChangePreview() {
  return <EventUpdate {...dateChange} />;
}
