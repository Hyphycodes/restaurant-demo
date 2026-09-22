import TicketConfirmation from '../../templates/TicketConfirmation';
import { ticketConfirmation } from '../../fixtures';

/** Preview: ticket-confirmation/a-editorial. Run `npm run email:dev` and open it in the sidebar. */
export default function AEditorialPreview() {
  return <TicketConfirmation {...ticketConfirmation} direction="editorial" />;
}
