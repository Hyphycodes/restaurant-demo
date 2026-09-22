import TicketResend from '../../templates/TicketResend';
import { brand, customer, vinylSession, threeTicketOrder, threeTickets } from '../../fixtures';

/** Preview: ticket-resend/resend. Run `npm run email:dev` and open it in the sidebar. */
export default function ResendPreview() {
  return <TicketResend brand={brand} customer={customer} event={vinylSession} order={threeTicketOrder} tickets={threeTickets} />;
}
