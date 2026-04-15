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
        },
      },
    }),
  },
});
