import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  applyMigrations,
  cleanDb,
  createTestUser,
  authFetch,
  getDb,
} from "./helpers";
import {
  oauthClients,
  oauthConsents,
  oauthAccessTokens,
  oauthRefreshTokens,
} from "../db/auth.schema";

describe("oauth-apps router", () => {
  let apiKey: string;
  let userId: string;

  beforeAll(async () => {
    await applyMigrations();
  });

  beforeEach(async () => {
    await cleanDb();
    ({ apiKey, userId } = await createTestUser());
  });

  describe("GET /api/oauth-apps", () => {
    it("returns empty list when no apps authorized", async () => {
      const res = await authFetch("/api/oauth-apps", { apiKey });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual([]);
    });

    it("returns authorized apps", async () => {
      const db = getDb();

      // Create an OAuth client
      await db.insert(oauthClients).values({
        id: "oc-1",
        clientId: "client-123",
        name: "Test App",
        redirectUris: JSON.stringify(["http://localhost"]),
      });

      // Create consent for user
      await db.insert(oauthConsents).values({
        id: "consent-1",
        clientId: "client-123",
        userId,
        scopes: JSON.stringify(["openid"]),
      });

      const res = await authFetch("/api/oauth-apps", { apiKey });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe("Test App");
    });
  });

  describe("DELETE /api/oauth-apps/:clientId", () => {
    it("revokes an app and deletes tokens/consent", async () => {
      const db = getDb();

      await db.insert(oauthClients).values({
        id: "oc-1",
        clientId: "client-123",
        name: "Test App",
        redirectUris: JSON.stringify(["http://localhost"]),
      });

      await db.insert(oauthConsents).values({
        id: "consent-1",
        clientId: "client-123",
        userId,
        scopes: JSON.stringify(["openid"]),
      });

      await db.insert(oauthAccessTokens).values({
        id: "at-1",
        token: "access-token-123",
        clientId: "client-123",
        userId,
        scopes: JSON.stringify(["openid"]),
      });

      const res = await authFetch("/api/oauth-apps/client-123", {
        apiKey,
        method: "DELETE",
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify consent was deleted
      const appsRes = await authFetch("/api/oauth-apps", { apiKey });
      const appsData = await appsRes.json();
      expect(appsData).toEqual([]);
    });
  });
});
