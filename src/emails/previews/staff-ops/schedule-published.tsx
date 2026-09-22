import SchedulePublished from '../../templates/staff/SchedulePublished';
import { schedulePublished } from '../../fixtures';

/** Preview: staff-ops/schedule-published. Run `npm run email:dev` and open it in the sidebar. */
export default function SchedulePublishedPreview() {
  return <SchedulePublished {...schedulePublished} />;
}
