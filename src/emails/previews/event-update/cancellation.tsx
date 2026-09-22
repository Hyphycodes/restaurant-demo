import EventUpdate from '../../templates/EventUpdate';
import { cancellation } from '../../fixtures';

/** Preview: event-update/cancellation. Run `npm run email:dev` and open it in the sidebar. */
export default function CancellationPreview() {
  return <EventUpdate {...cancellation} />;
}
