import TalentReceived from '../../templates/people/TalentReceived';
import { talentReceived } from '../../fixtures';

/** Preview: people/talent-received. Run `npm run email:dev` and open it in the sidebar. */
export default function TalentReceivedPreview() {
  return <TalentReceived {...talentReceived} />;
}
