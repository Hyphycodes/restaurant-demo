import ShiftChanged from '../../templates/staff/ShiftChanged';
import { shiftChanged } from '../../fixtures';

/** Preview: staff-ops/shift-changed. Run `npm run email:dev` and open it in the sidebar. */
export default function ShiftChangedPreview() {
  return <ShiftChanged {...shiftChanged} />;
}
