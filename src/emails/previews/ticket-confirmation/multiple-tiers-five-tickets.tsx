import TicketConfirmation from '../../templates/TicketConfirmation';
import { brand, customer, sundayClubSession, multiTierOrder, multiTierTickets } from '../../fixtures';

/** Preview: ticket-confirmation/multiple-tiers-five-tickets. Run `npm run email:dev` and open it in the sidebar. */
export default function MultipleTiersFiveTicketsPreview() {
  return <TicketConfirmation brand={brand} customer={customer} event={sundayClubSession} order={multiTierOrder} tickets={multiTierTickets} />;
}
