import ThanksForComing from '../templates/ThanksForComing';
import { brand, customer, vinylSession } from '../fixtures';

/** Preview: thanks-for-coming. Run `npm run email:dev` and open it in the sidebar. */
export default function ThanksForComingPreview() {
  return <ThanksForComing brand={brand} customer={customer} event={vinylSession} reviewUrl="/contact" />;
}
