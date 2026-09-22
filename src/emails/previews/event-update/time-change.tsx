import EventUpdate from '../../templates/EventUpdate';
import { timeChange } from '../../fixtures';

/** Preview: event-update/time-change. Run `npm run email:dev` and open it in the sidebar. */
export default function TimeChangePreview() {
  return <EventUpdate {...timeChange} />;
}
