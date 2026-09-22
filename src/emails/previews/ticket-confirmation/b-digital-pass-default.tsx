import TicketConfirmation from '../../templates/TicketConfirmation';
import { ticketConfirmation } from '../../fixtures';

/** Preview: ticket-confirmation/b-digital-pass-default. Run `npm run email:dev` and open it in the sidebar. */
export default function BDigitalPassDefaultPreview() {
  return <TicketConfirmation {...ticketConfirmation} direction="pass" />;
}
