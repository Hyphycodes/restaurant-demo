import RefundConfirmation from '../../templates/RefundConfirmation';
import { refund } from '../../fixtures';

/** Preview: refund/full-refund. Run `npm run email:dev` and open it in the sidebar. */
export default function FullRefundPreview() {
  return <RefundConfirmation {...refund} />;
}
