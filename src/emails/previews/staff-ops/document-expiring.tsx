import DocumentExpiring from '../../templates/staff/DocumentExpiring';
import { documentExpiring } from '../../fixtures';

/** Preview: staff-ops/document-expiring. Run `npm run email:dev` and open it in the sidebar. */
export default function DocumentExpiringPreview() {
  return <DocumentExpiring {...documentExpiring} />;
}
