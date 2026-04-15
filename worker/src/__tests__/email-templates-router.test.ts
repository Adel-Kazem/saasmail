import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  applyMigrations,
  cleanDb,
  createTestUser,
  createTestTemplate,
  authFetch,
} from "./helpers";

describe("email templates router", () => {
  let apiKey: string;

  beforeAll(async () => {
    await applyMigrations();
  });

  beforeEach(async () => {
    await cleanDb();
    ({ apiKey } = await createTestUser());
  });

  describe("POST /api/email-templates", () => {
    it("creates a template", async () => {
      const res = await authFetch("/api/email-templates", {
        apiKey,
        method: "POST",
        body: JSON.stringify({
          slug: "welcome-email",
          name: "Welcome",
          subject: "Welcome {{name}}",
          bodyHtml: "<p>Hi {{name}}</p>",
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.slug).toBe("welcome-email");
      expect(data.name).toBe("Welcome");
    });

    it("rejects invalid slug format", async () => {
      const res = await authFetch("/api/email-templates", {
        apiKey,
        method: "POST",
        body: JSON.stringify({
          slug: "Invalid Slug!",
          name: "Test",
          subject: "Test",
          bodyHtml: "<p>Test</p>",
        }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/email-templates", () => {
    it("lists all templates", async () => {
      await createTestTemplate({ slug: "welcome" });
      await createTestTemplate({ slug: "follow-up", name: "Follow Up" });

      const res = await authFetch("/api/email-templates", { apiKey });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(2);
    });
  });

  describe("GET /api/email-templates/:slug", () => {
    it("returns template by slug", async () => {
      await createTestTemplate({ slug: "welcome" });

      const res = await authFetch("/api/email-templates/welcome", {
        apiKey,
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.slug).toBe("welcome");
    });

    it("returns 404 for missing template", async () => {
      const res = await authFetch("/api/email-templates/nonexistent", {
        apiKey,
      });
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/email-templates/:slug", () => {
    it("updates template fields", async () => {
      await createTestTemplate({ slug: "welcome" });

      const res = await authFetch("/api/email-templates/welcome", {
        apiKey,
        method: "PUT",
        body: JSON.stringify({
          name: "Welcome Updated",
          subject: "Updated Subject",
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe("Welcome Updated");
      expect(data.subject).toBe("Updated Subject");
    });

    it("returns 404 for missing template", async () => {
      const res = await authFetch("/api/email-templates/nonexistent", {
        apiKey,
        method: "PUT",
        body: JSON.stringify({ name: "Test" }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/email-templates/:slug", () => {
    it("deletes a template", async () => {
      await createTestTemplate({ slug: "welcome" });

      const res = await authFetch("/api/email-templates/welcome", {
        apiKey,
        method: "DELETE",
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      const getRes = await authFetch("/api/email-templates/welcome", {
        apiKey,
      });
      expect(getRes.status).toBe(404);
    });

    it("returns 404 for missing template", async () => {
      const res = await authFetch("/api/email-templates/nonexistent", {
        apiKey,
        method: "DELETE",
      });
      expect(res.status).toBe(404);
    });
  });
});
