import RefundConfirmation from '../../templates/RefundConfirmation';
import { partialRefund } from '../../fixtures';

/** Preview: refund/partial-refund. Run `npm run email:dev` and open it in the sidebar. */
export default function PartialRefundPreview() {
  return <RefundConfirmation {...partialRefund} />;
}
