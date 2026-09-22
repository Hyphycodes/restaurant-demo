import TimeOffDecision from '../../templates/staff/TimeOffDecision';
import { timeOffDecision } from '../../fixtures';

/** Preview: staff-ops/time-off-decision. Run `npm run email:dev` and open it in the sidebar. */
export default function TimeOffDecisionPreview() {
  return <TimeOffDecision {...timeOffDecision} />;
}
