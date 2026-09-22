import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAdminOpen } from './admin-access';
afterEach(() => vi.unstubAllEnvs());
describe('production admin gate', () => {
  it.each(['true', 'false', '', 'TRUE', 'yes'])('requires sign-in in production even for %s', (value) => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('ADMIN_REQUIRE_SIGN_IN', value);
    expect(isAdminOpen()).toBe(false);
  });
  it('requires sign-in by default in development', () => {
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('ADMIN_REQUIRE_SIGN_IN', '');
    expect(isAdminOpen()).toBe(false);
  });
  it('allows an explicit local demo opt out', () => {
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('ADMIN_REQUIRE_SIGN_IN', ' false ');
    expect(isAdminOpen()).toBe(true);
  });
});
