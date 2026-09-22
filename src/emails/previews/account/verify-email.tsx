import VerifyEmail from '../../templates/VerifyEmail';
import { brand } from '../../fixtures';

/** Preview: account/verify-email. Run `npm run email:dev` and open it in the sidebar. */
export default function VerifyEmailPreview() {
  return <VerifyEmail brand={brand} name={null} email="alex@example.com" actionUrl="https://restaurant-demo.vercel.app/auth/callback?code=preview" expiresInMinutes={1440} />;
}
