/**
 * Returns true when the worker is running in a local/test environment where
 * passkey enforcement should be relaxed so maintainers can exercise the UI
 * without a real WebAuthn ceremony.
 *
 * Gated by an explicit `DISABLE_PASSKEY_GATE="true"` var rather than a URL
 * heuristic — deployers sometimes point their local `wrangler.jsonc` at a
 * real staging host, so BASE_URL isn't a reliable signal. Must be opt-in.
 */
export function isDevEnvironment(env: CloudflareBindings | undefined): boolean {
  return (env as any)?.DISABLE_PASSKEY_GATE === "true";
}
