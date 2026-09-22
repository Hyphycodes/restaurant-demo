import TicketConfirmation from '../../templates/TicketConfirmation';
import { brand, customer, vinylSession, itemizedOrder, threeTickets } from '../../fixtures';

/** Preview: ticket-confirmation/itemized-fees. Run `npm run email:dev` and open it in the sidebar. */
export default function ItemizedFeesPreview() {
  return <TicketConfirmation brand={brand} customer={customer} event={vinylSession} order={itemizedOrder} tickets={threeTickets.slice(0, 2)} />;
}
