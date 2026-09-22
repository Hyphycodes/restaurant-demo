import PasswordReset from '../../templates/PasswordReset';
import { brand } from '../../fixtures';

/** Preview: account/password-reset. Run `npm run email:dev` and open it in the sidebar. */
export default function PasswordResetPreview() {
  return <PasswordReset brand={brand} name="Nico Moretti" email="alex@example.com" actionUrl="https://restaurant-demo-two-zeta.vercel.app/auth/callback?code=preview" expiresInMinutes={60} />;
}
