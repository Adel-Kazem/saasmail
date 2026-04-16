import { beforeEach, describe, expect, it } from "vitest";
import {
  applyMigrations,
  authFetch,
  cleanDb,
  createTestEmail,
  createTestPerson,
  createTestUser,
  getDb,
} from "./helpers";
import { inboxPermissions } from "../db/inbox-permissions.schema";

async function grantInbox(userId: string, email: string) {
  await getDb().insert(inboxPermissions).values({
    userId,
    email,
    createdAt: Math.floor(Date.now() / 1000),
    createdBy: null,
  });
}

beforeEach(async () => {
  await applyMigrations();
  await cleanDb();
});

describe("stats scoping", () => {
  it("admin sees all recipients and totals", async () => {
    const { apiKey } = await createTestUser({ role: "admin" });
    await createTestPerson({ id: "p1" });
    await createTestPerson({ id: "p2", email: "alice2@example.com" });
    await createTestEmail({ id: "e1", personId: "p1", recipient: "a@x.com" });
    await createTestEmail({
      id: "e2",
      personId: "p2",
      recipient: "b@x.com",
      messageId: "m2",
    });
    const res = await authFetch("/api/stats", { apiKey });
    const body = (await res.json()) as {
      totalEmails: number;
      recipients: string[];
    };
    expect(body.totalEmails).toBe(2);
    expect(body.recipients.sort()).toEqual(["a@x.com", "b@x.com"]);
  });

  it("member sees only assigned recipients and counts", async () => {
    await createTestUser({ id: "u-admin", role: "admin" });
    const { apiKey, userId } = await createTestUser({
      id: "u-mem",
      role: "member",
      email: "m@x.com",
    });
    await createTestPerson({ id: "p1" });
    await createTestEmail({ id: "e1", personId: "p1", recipient: "a@x.com" });
    await createTestEmail({
      id: "e2",
      personId: "p1",
      recipient: "b@x.com",
      messageId: "m2",
    });
    await grantInbox(userId, "a@x.com");
    const res = await authFetch("/api/stats", { apiKey });
    const body = (await res.json()) as {
      totalEmails: number;
      recipients: string[];
    };
    expect(body.totalEmails).toBe(1);
    expect(body.recipients).toEqual(["a@x.com"]);
  });

  it("member with zero inboxes sees empty stats", async () => {
    const { apiKey } = await createTestUser({ id: "u-mem", role: "member" });
    await createTestPerson({ id: "p1" });
    await createTestEmail({ id: "e1", personId: "p1", recipient: "a@x.com" });
    const res = await authFetch("/api/stats", { apiKey });
    const body = (await res.json()) as {
      totalEmails: number;
      recipients: string[];
    };
    expect(body.totalEmails).toBe(0);
    expect(body.recipients).toEqual([]);
  });
});

describe("emails scoping", () => {
  it("member listing by-person excludes disallowed recipients", async () => {
    const { apiKey, userId } = await createTestUser({
      id: "u-mem",
      role: "member",
      email: "m@x.com",
    });
    await createTestPerson({ id: "p1" });
    await createTestEmail({ id: "e1", personId: "p1", recipient: "a@x.com" });
    await createTestEmail({
      id: "e2",
      personId: "p1",
      recipient: "b@x.com",
      messageId: "m2",
    });
    await grantInbox(userId, "a@x.com");
    const res = await authFetch("/api/emails/by-person/p1", { apiKey });
    const body = (await res.json()) as Array<{ recipient: string }>;
    const recipients = body.map((e) => e.recipient);
    expect(recipients).toEqual(["a@x.com"]);
  });
});
