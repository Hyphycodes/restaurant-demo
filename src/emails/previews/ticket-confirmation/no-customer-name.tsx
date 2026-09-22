import TicketConfirmation from '../../templates/TicketConfirmation';
import { brand, anonymousCustomer, vinylSession, singleTicketOrder, singleTicket } from '../../fixtures';

/** Preview: ticket-confirmation/no-customer-name. Run `npm run email:dev` and open it in the sidebar. */
export default function NoCustomerNamePreview() {
  return <TicketConfirmation brand={brand} customer={anonymousCustomer} event={vinylSession} order={singleTicketOrder} tickets={singleTicket} />;
}
