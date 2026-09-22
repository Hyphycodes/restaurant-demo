import TicketConfirmation from '../../templates/TicketConfirmation';
import { brand, customer, vinylSession, singleTicketOrder, singleTicket } from '../../fixtures';

/** Preview: ticket-confirmation/single-ticket. Run `npm run email:dev` and open it in the sidebar. */
export default function SingleTicketPreview() {
  return <TicketConfirmation brand={brand} customer={customer} event={vinylSession} order={singleTicketOrder} tickets={singleTicket} />;
}
