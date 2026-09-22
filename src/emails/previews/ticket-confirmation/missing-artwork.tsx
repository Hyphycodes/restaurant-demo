import TicketConfirmation from '../../templates/TicketConfirmation';
import { brand, customer, noArtworkEvent, threeTicketOrder, threeTickets } from '../../fixtures';

/** Preview: ticket-confirmation/missing-artwork. Run `npm run email:dev` and open it in the sidebar. */
export default function MissingArtworkPreview() {
  return <TicketConfirmation brand={brand} customer={customer} event={noArtworkEvent} order={threeTicketOrder} tickets={threeTickets} />;
}
