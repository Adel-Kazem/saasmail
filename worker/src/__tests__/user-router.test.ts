import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  applyMigrations,
  cleanDb,
  createTestUser,
  authFetch,
  getDb,
} from "./helpers";
import { passkeys } from "../db/auth.schema";

describe("user router", () => {
  let apiKey: string;
  let userId: string;

  beforeAll(async () => {
    await applyMigrations();
  });

  beforeEach(async () => {
    await cleanDb();
    ({ apiKey, userId } = await createTestUser());
  });

  describe("GET /api/user/passkeys", () => {
    it("returns hasPasskey=false when no passkeys", async () => {
      const res = await authFetch("/api/user/passkeys", { apiKey });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.hasPasskey).toBe(false);
    });

    it("returns hasPasskey=true when passkey exists", async () => {
      const db = getDb();
      await db.insert(passkeys).values({
        id: "pk-1",
        publicKey: "test-public-key",
        userId,
        credentialID: "cred-123",
        counter: 0,
        deviceType: "singleDevice",
        backedUp: false,
      });

      const res = await authFetch("/api/user/passkeys", { apiKey });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.hasPasskey).toBe(true);
    });
  });
});
