import TicketConfirmation from '../../templates/TicketConfirmation';
import { ticketConfirmation } from '../../fixtures';

/** Preview: ticket-confirmation/c-poster. Run `npm run email:dev` and open it in the sidebar. */
export default function CPosterPreview() {
  return <TicketConfirmation {...ticketConfirmation} direction="poster" />;
}
