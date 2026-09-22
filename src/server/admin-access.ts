/** Production always requires a verified staff account. Local demos may opt out. */
export function isAdminOpen(): boolean {
  return process.env.NODE_ENV === 'development' &&
    process.env.ADMIN_REQUIRE_SIGN_IN?.trim() === 'false';
}
