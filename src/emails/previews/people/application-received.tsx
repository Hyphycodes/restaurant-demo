import ApplicationReceived from '../../templates/people/ApplicationReceived';
import { applicationReceived } from '../../fixtures';

/** Preview: people/application-received. Run `npm run email:dev` and open it in the sidebar. */
export default function ApplicationReceivedPreview() {
  return <ApplicationReceived {...applicationReceived} />;
}
