import TrainingRequired from '../../templates/staff/TrainingRequired';
import { trainingRequired } from '../../fixtures';

/** Preview: staff-ops/training-required. Run `npm run email:dev` and open it in the sidebar. */
export default function TrainingRequiredPreview() {
  return <TrainingRequired {...trainingRequired} />;
}
