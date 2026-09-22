import TicketConfirmation from '../../templates/TicketConfirmation';
import { ticketConfirmation } from '../../fixtures';

/** Preview: ticket-confirmation/test-send. Run `npm run email:dev` and open it in the sidebar. */
export default function TestSendPreview() {
  return <TicketConfirmation {...ticketConfirmation} test />;
}
