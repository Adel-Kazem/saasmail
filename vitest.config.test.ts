import { defineConfig } from "vitest/config";
import { cloudflarePool } from "@cloudflare/vitest-pool-workers";

export default defineConfig({
  test: {
    globals: true,
    include: ["worker/src/__tests__/**/*.test.ts"],
    pool: cloudflarePool({
      wrangler: {
        configPath: "./wrangler.jsonc",
      },
      miniflare: {
        bindings: {
          RESEND_API_KEY: "re_test_fake_key",
          // Tests authenticate via API keys (no WebAuthn ceremony available).
          // Disable the passkey gate so the existing fixtures keep working;
          // the enforcement itself is covered by targeted tests in
          // `__tests__/passkey-enforcement.test.ts`.
          DISABLE_PASSKEY_GATE: "true",
          // `.dev.vars` sets DEMO_MODE=1 for `yarn dev`, and miniflare
          // auto-loads those secrets. Force it off for tests so sequence
          // processor / enroll route exercise real (non-demo) behavior.
          DEMO_MODE: "0",
        },
      },
    }),
  },
});
