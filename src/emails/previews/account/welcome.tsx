import Welcome from '../../templates/Welcome';
import { brand } from '../../fixtures';

/** Preview: account/welcome. Run `npm run email:dev` and open it in the sidebar. */
export default function WelcomePreview() {
  return <Welcome brand={brand} name="Jamie Morgan" email="maria@example.com" actionUrl="https://restaurant-demo-two-zeta.vercel.app/tickets" expiresInMinutes={null} />;
}
