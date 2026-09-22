import SubmissionAlert from '../../templates/people/SubmissionAlert';
import { submissionAlert } from '../../fixtures';

/** Preview: people/submission-alert. Run `npm run email:dev` and open it in the sidebar. */
export default function SubmissionAlertPreview() {
  return <SubmissionAlert {...submissionAlert} />;
}
