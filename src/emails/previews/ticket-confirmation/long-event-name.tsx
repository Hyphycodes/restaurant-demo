import TicketConfirmation from '../../templates/TicketConfirmation';
import { brand, customer, longTitleEvent, threeTicketOrder, threeTickets } from '../../fixtures';

/** Preview: ticket-confirmation/long-event-name. Run `npm run email:dev` and open it in the sidebar. */
export default function LongEventNamePreview() {
  return <TicketConfirmation brand={brand} customer={customer} event={longTitleEvent} order={threeTicketOrder} tickets={threeTickets} />;
}
