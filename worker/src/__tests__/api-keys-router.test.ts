import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  applyMigrations,
  cleanDb,
  createTestUser,
  authFetch,
  getDb,
} from "./helpers";
import { apiKeys } from "../db/api-keys.schema";
import { eq } from "drizzle-orm";

describe("api-keys router", () => {
  let apiKey: string;
  let userId: string;

  beforeAll(async () => {
    await applyMigrations();
  });

  beforeEach(async () => {
    await cleanDb();
    ({ apiKey, userId } = await createTestUser());
  });

  describe("GET /api/api-keys", () => {
    it("returns key info (key already exists from test setup)", async () => {
      const res = await authFetch("/api/api-keys", { apiKey });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.key).not.toBeNull();
      expect(data.key.prefix).toMatch(/^sk_/);
    });
  });

  describe("POST /api/api-keys", () => {
    it("generates a new api key (replaces existing)", async () => {
      const res = await authFetch("/api/api-keys", {
        apiKey,
        method: "POST",
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.key).toMatch(/^sk_[0-9a-f]{32}$/);
      expect(data.prefix).toMatch(/^sk_.*\.\.\.$/);

      // Verify only one key exists for the user
      const db = getDb();
      const rows = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.userId, userId));
      expect(rows).toHaveLength(1);
    });
  });

  describe("DELETE /api/api-keys", () => {
    it("revokes the key", async () => {
      const res = await authFetch("/api/api-keys", {
        apiKey,
        method: "DELETE",
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify key is gone in DB
      const db = getDb();
      const rows = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.userId, userId));
      expect(rows).toHaveLength(0);
    });
  });

  describe("API key authentication", () => {
    it("authenticates via Bearer sk_ token", async () => {
      const res = await authFetch("/api/senders", { apiKey });
      expect(res.status).toBe(200);
    });

    it("rejects invalid api key", async () => {
      const res = await authFetch("/api/senders", {
        apiKey: "sk_invalid_key_here_1234567890ab",
      });
      expect(res.status).toBe(401);
    });
  });
});
