import EventReminder from '../../templates/EventReminder';
import { brand, customer, vinylSession, threeTicketOrder, threeTickets } from '../../fixtures';

/** Preview: event-reminder/tomorrow. Run `npm run email:dev` and open it in the sidebar. */
export default function TomorrowPreview() {
  return <EventReminder brand={brand} customer={customer} event={vinylSession} order={threeTicketOrder} tickets={threeTickets} timing="tomorrow" />;
}
