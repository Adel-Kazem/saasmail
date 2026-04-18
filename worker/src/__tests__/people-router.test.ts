import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  applyMigrations,
  cleanDb,
  createTestUser,
  createTestPerson,
  createTestEmail,
  authFetch,
} from "./helpers";

describe("people router", () => {
  let apiKey: string;

  beforeAll(async () => {
    await applyMigrations();
  });

  beforeEach(async () => {
    await cleanDb();
    ({ apiKey } = await createTestUser());
  });

  describe("GET /api/people", () => {
    it("returns empty list when no people", async () => {
      const res = await authFetch("/api/people", { apiKey });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toEqual([]);
    });

    it("returns people sorted by lastEmailAt desc", async () => {
      await createTestPerson({ id: "s1", email: "a@test.com", name: "A" });
      await createTestPerson({ id: "s2", email: "b@test.com", name: "B" });
      await createTestEmail({ id: "e1", personId: "s1" });
      await createTestEmail({
        id: "e2",
        personId: "s2",
        messageId: "msg-2@example.com",
      });

      const res = await authFetch("/api/people", { apiKey });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(2);
    });

    it("searches by name", async () => {
      await createTestPerson({ id: "s1", email: "a@test.com", name: "Alice" });
      await createTestPerson({ id: "s2", email: "b@test.com", name: "Bob" });
      await createTestEmail({ id: "e1", personId: "s1" });
      await createTestEmail({
        id: "e2",
        personId: "s2",
        messageId: "msg-2@example.com",
      });

      const res = await authFetch("/api/people?q=alice", { apiKey });
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe("Alice");
    });

    it("searches by email", async () => {
      await createTestPerson({
        id: "s1",
        email: "alice@test.com",
        name: "Alice",
      });
      await createTestPerson({ id: "s2", email: "bob@test.com", name: "Bob" });
      await createTestEmail({ id: "e1", personId: "s1" });
      await createTestEmail({
        id: "e2",
        personId: "s2",
        messageId: "msg-2@example.com",
      });

      const res = await authFetch("/api/people?q=bob%40test", { apiKey });
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].email).toBe("bob@test.com");
    });

    it("paginates results", async () => {
      await createTestPerson({ id: "s1", email: "a@test.com" });
      await createTestPerson({ id: "s2", email: "b@test.com" });
      await createTestPerson({ id: "s3", email: "c@test.com" });
      await createTestEmail({ id: "e1", personId: "s1" });
      await createTestEmail({
        id: "e2",
        personId: "s2",
        messageId: "msg-2@example.com",
      });
      await createTestEmail({
        id: "e3",
        personId: "s3",
        messageId: "msg-3@example.com",
      });

      const res = await authFetch("/api/people?page=1&limit=2", {
        apiKey,
      });
      const body = await res.json();
      expect(body.data).toHaveLength(2);
    });

    it("includes latestSubject from most recent email", async () => {
      await createTestPerson({ id: "s1", email: "a@test.com" });
      await createTestEmail({
        id: "e1",
        personId: "s1",
        subject: "Latest Subject",
      });

      const res = await authFetch("/api/people", { apiKey });
      const body = await res.json();
      expect(body.data[0].latestSubject).toBe("Latest Subject");
    });

    it("filters by recipient", async () => {
      await createTestPerson({ id: "s1", email: "a@test.com" });
      await createTestPerson({ id: "s2", email: "b@test.com" });
      await createTestEmail({
        id: "e1",
        personId: "s1",
        recipient: "inbox@saasmail.test",
      });
      await createTestEmail({
        id: "e2",
        personId: "s2",
        recipient: "other@saasmail.test",
        messageId: "msg-2@example.com",
      });

      const res = await authFetch(
        "/api/people?recipient=inbox%40saasmail.test",
        {
          apiKey,
        },
      );
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe("s1");
    });
  });

  describe("GET /api/people/:id", () => {
    it("returns person by id", async () => {
      await createTestPerson({ id: "s1", email: "a@test.com", name: "Alice" });

      const res = await authFetch("/api/people/s1", { apiKey });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.email).toBe("a@test.com");
      expect(data.name).toBe("Alice");
    });

    it("returns 404 for unknown person", async () => {
      const res = await authFetch("/api/people/unknown", { apiKey });
      expect(res.status).toBe(404);
    });
  });
});
