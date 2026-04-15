import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  applyMigrations,
  cleanDb,
  createTestUser,
  createTestSender,
  createTestEmail,
  getDb,
} from "./helpers";
import { exports } from "cloudflare:workers";
import {
  oauthClients,
  oauthAccessTokens,
  oauthConsents,
} from "../db/auth.schema";
import { sentEmails } from "../db/sent-emails.schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Create an OAuth access token for MCP auth and return the raw token string. */
async function createOAuthToken(userId: string) {
  const db = getDb();

  // Ensure an OAuth client exists for the token FK
  await db
    .insert(oauthClients)
    .values({
      id: "oc-mcp",
      clientId: "mcp-client",
      name: "MCP Test Client",
      redirectUris: JSON.stringify(["http://localhost"]),
    })
    .onConflictDoNothing();

  const token = `mcp-test-token-${Date.now()}`;
  await db.insert(oauthAccessTokens).values({
    id: `at-${Date.now()}`,
    token,
    clientId: "mcp-client",
    userId,
    scopes: JSON.stringify(["openid"]),
  });
  return token;
}

/** Send a JSON-RPC request to the MCP endpoint. */
async function mcpFetch(
  body: unknown,
  opts: { token?: string } = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.token) {
    headers["Authorization"] = `Bearer ${opts.token}`;
  }
  return exports.default.fetch("http://localhost/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

/** Shorthand for a single JSON-RPC call that returns the parsed response. */
async function rpc(
  method: string,
  params: Record<string, unknown> | undefined,
  token: string,
  id: number | string = 1,
) {
  const res = await mcpFetch(
    { jsonrpc: "2.0", id, method, params },
    { token },
  );
  return res.json() as Promise<any>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("MCP router", () => {
  let userId: string;
  let token: string;

  beforeAll(async () => {
    await applyMigrations();
  });

  beforeEach(async () => {
    await cleanDb();
    ({ userId } = await createTestUser());
    token = await createOAuthToken(userId);
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  describe("authentication", () => {
    it("returns 401 without a token", async () => {
      const res = await mcpFetch({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
      });
      expect(res.status).toBe(401);
      expect(res.headers.get("WWW-Authenticate")).toContain(
        "oauth-protected-resource",
      );
    });

    it("returns 401 with an invalid token", async () => {
      const res = await mcpFetch(
        { jsonrpc: "2.0", id: 1, method: "initialize" },
        { token: "bogus-token" },
      );
      expect(res.status).toBe(401);
    });
  });

  // ── GET not allowed ───────────────────────────────────────────────────────

  describe("GET /mcp", () => {
    it("returns 405 Method Not Allowed", async () => {
      const res = await exports.default.fetch("http://localhost/mcp", {
        method: "GET",
      });
      expect(res.status).toBe(405);
    });
  });

  // ── Protocol lifecycle ────────────────────────────────────────────────────

  describe("initialize", () => {
    it("returns server info and capabilities", async () => {
      const data = await rpc("initialize", undefined, token);
      expect(data.jsonrpc).toBe("2.0");
      expect(data.id).toBe(1);
      expect(data.result.protocolVersion).toBe("2025-06-18");
      expect(data.result.serverInfo.name).toBe("cmail");
      expect(data.result.capabilities.tools).toBeDefined();
    });
  });

  describe("ping", () => {
    it("returns empty result", async () => {
      const data = await rpc("ping", undefined, token);
      expect(data.result).toEqual({});
    });
  });

  describe("notifications", () => {
    it("returns 202 for notifications/initialized (no id)", async () => {
      const res = await mcpFetch(
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { token },
      );
      expect(res.status).toBe(202);
    });

    it("returns 202 for notifications/cancelled (no id)", async () => {
      const res = await mcpFetch(
        { jsonrpc: "2.0", method: "notifications/cancelled" },
        { token },
      );
      expect(res.status).toBe(202);
    });
  });

  // ── tools/list ────────────────────────────────────────────────────────────

  describe("tools/list", () => {
    it("returns all tool definitions", async () => {
      const data = await rpc("tools/list", undefined, token);
      const tools = data.result.tools;
      expect(tools.length).toBeGreaterThanOrEqual(8);

      const names = tools.map((t: any) => t.name);
      expect(names).toContain("cmail_list_senders");
      expect(names).toContain("cmail_send_email");
      expect(names).toContain("cmail_delete_email");

      // Each tool should have an inputSchema
      for (const tool of tools) {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe("object");
      }
    });
  });

  // ── resources/list & prompts/list ─────────────────────────────────────────

  describe("resources/list", () => {
    it("returns empty resources array", async () => {
      const data = await rpc("resources/list", undefined, token);
      expect(data.result).toEqual({ resources: [] });
    });
  });

  describe("prompts/list", () => {
    it("returns empty prompts array", async () => {
      const data = await rpc("prompts/list", undefined, token);
      expect(data.result).toEqual({ prompts: [] });
    });
  });

  // ── Unknown method ────────────────────────────────────────────────────────

  describe("unknown method", () => {
    it("returns -32601 Method not found", async () => {
      const data = await rpc("nonexistent/method", undefined, token);
      expect(data.error.code).toBe(-32601);
      expect(data.error.message).toContain("Method not found");
    });
  });

  // ── Parse error ───────────────────────────────────────────────────────────

  describe("parse error", () => {
    it("returns -32700 for invalid JSON", async () => {
      const res = await exports.default.fetch("http://localhost/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: "not json",
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error.code).toBe(-32700);
    });
  });

  // ── Invalid request ───────────────────────────────────────────────────────

  describe("invalid request", () => {
    it("returns -32600 for missing jsonrpc field", async () => {
      const data = await rpc("initialize", undefined, token);
      // Now send a bad one
      const res = await mcpFetch(
        { id: 1, method: "initialize" },
        { token },
      );
      const bad = (await res.json()) as any;
      expect(bad.error.code).toBe(-32600);
    });
  });

  // ── Batch requests ────────────────────────────────────────────────────────

  describe("batch requests", () => {
    it("handles a batch of requests", async () => {
      const res = await mcpFetch(
        [
          { jsonrpc: "2.0", id: 1, method: "ping" },
          { jsonrpc: "2.0", id: 2, method: "tools/list" },
        ],
        { token },
      );
      const data = (await res.json()) as any[];
      expect(data).toHaveLength(2);
      const ids = data.map((r: any) => r.id);
      expect(ids).toContain(1);
      expect(ids).toContain(2);
    });

    it("returns 202 for batch of only notifications", async () => {
      const res = await mcpFetch(
        [
          { jsonrpc: "2.0", method: "notifications/initialized" },
          { jsonrpc: "2.0", method: "notifications/cancelled" },
        ],
        { token },
      );
      expect(res.status).toBe(202);
    });
  });

  // ── tools/call: cmail_list_senders ────────────────────────────────────────

  describe("cmail_list_senders", () => {
    it("returns empty list when no senders exist", async () => {
      const data = await rpc(
        "tools/call",
        { name: "cmail_list_senders", arguments: {} },
        token,
      );
      const content = JSON.parse(data.result.content[0].text);
      expect(content).toEqual([]);
    });

    it("returns senders sorted by newest first", async () => {
      const db = getDb();
      const now = Math.floor(Date.now() / 1000);

      await createTestSender({
        id: "s-old",
        email: "old@test.com",
        name: "Old",
      });
      // Update lastEmailAt to be older
      const { senders } = await import("../db/senders.schema");
      const { eq } = await import("drizzle-orm");
      await db
        .update(senders)
        .set({ lastEmailAt: now - 1000 })
        .where(eq(senders.id, "s-old"));

      await createTestSender({
        id: "s-new",
        email: "new@test.com",
        name: "New",
      });
      await db
        .update(senders)
        .set({ lastEmailAt: now })
        .where(eq(senders.id, "s-new"));

      const data = await rpc(
        "tools/call",
        { name: "cmail_list_senders", arguments: {} },
        token,
      );
      const content = JSON.parse(data.result.content[0].text);
      expect(content).toHaveLength(2);
      expect(content[0].id).toBe("s-new");
      expect(content[1].id).toBe("s-old");
    });

    it("filters senders by search query", async () => {
      await createTestSender({
        id: "s1",
        email: "alice@test.com",
        name: "Alice",
      });
      await createTestSender({
        id: "s2",
        email: "bob@test.com",
        name: "Bob",
      });

      const data = await rpc(
        "tools/call",
        { name: "cmail_list_senders", arguments: { q: "alice" } },
        token,
      );
      const content = JSON.parse(data.result.content[0].text);
      expect(content).toHaveLength(1);
      expect(content[0].email).toBe("alice@test.com");
    });

    it("escapes LIKE wildcards in search", async () => {
      await createTestSender({
        id: "s1",
        email: "test%special@test.com",
        name: "Special",
      });
      await createTestSender({
        id: "s2",
        email: "normal@test.com",
        name: "Normal",
      });

      // Searching for literal "%" should only match the sender with % in email,
      // not act as a wildcard matching everything
      const data = await rpc(
        "tools/call",
        { name: "cmail_list_senders", arguments: { q: "test%special" } },
        token,
      );
      const content = JSON.parse(data.result.content[0].text);
      expect(content).toHaveLength(1);
      expect(content[0].email).toBe("test%special@test.com");
    });

    it("paginates results", async () => {
      await createTestSender({
        id: "s1",
        email: "a@test.com",
        name: "A",
      });
      await createTestSender({
        id: "s2",
        email: "b@test.com",
        name: "B",
      });

      const data = await rpc(
        "tools/call",
        {
          name: "cmail_list_senders",
          arguments: { page: 1, limit: 1 },
        },
        token,
      );
      const content = JSON.parse(data.result.content[0].text);
      expect(content).toHaveLength(1);
    });
  });

  // ── tools/call: cmail_get_sender ──────────────────────────────────────────

  describe("cmail_get_sender", () => {
    it("returns sender details", async () => {
      await createTestSender({
        id: "s1",
        email: "alice@test.com",
        name: "Alice",
      });
      const data = await rpc(
        "tools/call",
        { name: "cmail_get_sender", arguments: { sender_id: "s1" } },
        token,
      );
      const content = JSON.parse(data.result.content[0].text);
      expect(content.email).toBe("alice@test.com");
      expect(content.name).toBe("Alice");
    });

    it("returns error for non-existent sender", async () => {
      const data = await rpc(
        "tools/call",
        { name: "cmail_get_sender", arguments: { sender_id: "nope" } },
        token,
      );
      expect(data.result.isError).toBe(true);
      expect(data.result.content[0].text).toContain("not found");
    });

    it("returns error when sender_id is missing", async () => {
      const data = await rpc(
        "tools/call",
        { name: "cmail_get_sender", arguments: {} },
        token,
      );
      expect(data.result.isError).toBe(true);
    });
  });

  // ── tools/call: cmail_list_emails ─────────────────────────────────────────

  describe("cmail_list_emails", () => {
    it("returns received and sent emails combined", async () => {
      const db = getDb();
      const now = Math.floor(Date.now() / 1000);

      await createTestSender({ id: "s1", email: "alice@test.com" });
      await createTestEmail({
        id: "recv-1",
        senderId: "s1",
        subject: "Received",
      });

      await db.insert(sentEmails).values({
        id: "sent-1",
        senderId: "s1",
        fromAddress: "me@cmail.test",
        toAddress: "alice@test.com",
        subject: "Sent",
        bodyHtml: "<p>Reply</p>",
        status: "sent",
        sentAt: now,
        createdAt: now,
      });

      const data = await rpc(
        "tools/call",
        { name: "cmail_list_emails", arguments: { sender_id: "s1" } },
        token,
      );
      const content = JSON.parse(data.result.content[0].text);
      expect(content).toHaveLength(2);

      const types = content.map((e: any) => e.type);
      expect(types).toContain("received");
      expect(types).toContain("sent");
    });

    it("returns error when sender_id is missing", async () => {
      const data = await rpc(
        "tools/call",
        { name: "cmail_list_emails", arguments: {} },
        token,
      );
      expect(data.result.isError).toBe(true);
    });
  });

  // ── tools/call: cmail_read_email ──────────────────────────────────────────

  describe("cmail_read_email", () => {
    it("reads a received email", async () => {
      await createTestSender({ id: "s1", email: "alice@test.com" });
      await createTestEmail({
        id: "e1",
        senderId: "s1",
        subject: "Hello",
      });

      const data = await rpc(
        "tools/call",
        { name: "cmail_read_email", arguments: { email_id: "e1" } },
        token,
      );
      const content = JSON.parse(data.result.content[0].text);
      expect(content.type).toBe("received");
      expect(content.subject).toBe("Hello");
    });

    it("reads a sent email", async () => {
      const db = getDb();
      const now = Math.floor(Date.now() / 1000);

      await db.insert(sentEmails).values({
        id: "se1",
        senderId: null,
        fromAddress: "me@cmail.test",
        toAddress: "bob@test.com",
        subject: "Outgoing",
        bodyHtml: "<p>Hi</p>",
        status: "sent",
        sentAt: now,
        createdAt: now,
      });

      const data = await rpc(
        "tools/call",
        { name: "cmail_read_email", arguments: { email_id: "se1" } },
        token,
      );
      const content = JSON.parse(data.result.content[0].text);
      expect(content.type).toBe("sent");
      expect(content.subject).toBe("Outgoing");
    });

    it("returns error for non-existent email", async () => {
      const data = await rpc(
        "tools/call",
        { name: "cmail_read_email", arguments: { email_id: "nope" } },
        token,
      );
      expect(data.result.isError).toBe(true);
      expect(data.result.content[0].text).toContain("not found");
    });
  });

  // ── tools/call: cmail_mark_email ──────────────────────────────────────────

  describe("cmail_mark_email", () => {
    it("marks an email as read", async () => {
      await createTestSender({ id: "s1", email: "alice@test.com" });
      await createTestEmail({ id: "e1", senderId: "s1", isRead: 0 });

      const data = await rpc(
        "tools/call",
        {
          name: "cmail_mark_email",
          arguments: { email_id: "e1", is_read: true },
        },
        token,
      );
      const content = JSON.parse(data.result.content[0].text);
      expect(content.success).toBe(true);

      // Verify via read
      const readData = await rpc(
        "tools/call",
        { name: "cmail_read_email", arguments: { email_id: "e1" } },
        token,
      );
      const email = JSON.parse(readData.result.content[0].text);
      expect(email.isRead).toBe(1);
    });

    it("marks an email as unread", async () => {
      await createTestSender({ id: "s1", email: "alice@test.com" });
      await createTestEmail({ id: "e1", senderId: "s1", isRead: 1 });

      const data = await rpc(
        "tools/call",
        {
          name: "cmail_mark_email",
          arguments: { email_id: "e1", is_read: false },
        },
        token,
      );
      const content = JSON.parse(data.result.content[0].text);
      expect(content.success).toBe(true);
    });

    it("returns error when args are missing", async () => {
      const data = await rpc(
        "tools/call",
        { name: "cmail_mark_email", arguments: {} },
        token,
      );
      expect(data.result.isError).toBe(true);
    });
  });

  // ── tools/call: cmail_delete_email ────────────────────────────────────────

  describe("cmail_delete_email", () => {
    it("deletes a received email", async () => {
      await createTestSender({ id: "s1", email: "alice@test.com" });
      await createTestEmail({ id: "e1", senderId: "s1" });

      const data = await rpc(
        "tools/call",
        { name: "cmail_delete_email", arguments: { email_id: "e1" } },
        token,
      );
      const content = JSON.parse(data.result.content[0].text);
      expect(content.success).toBe(true);

      // Verify email is gone
      const readData = await rpc(
        "tools/call",
        { name: "cmail_read_email", arguments: { email_id: "e1" } },
        token,
      );
      expect(readData.result.isError).toBe(true);
    });

    it("deletes a sent email", async () => {
      const db = getDb();
      const now = Math.floor(Date.now() / 1000);
      await db.insert(sentEmails).values({
        id: "se1",
        senderId: null,
        fromAddress: "me@cmail.test",
        toAddress: "bob@test.com",
        subject: "Delete me",
        bodyHtml: "<p>bye</p>",
        status: "sent",
        sentAt: now,
        createdAt: now,
      });

      const data = await rpc(
        "tools/call",
        { name: "cmail_delete_email", arguments: { email_id: "se1" } },
        token,
      );
      const content = JSON.parse(data.result.content[0].text);
      expect(content.success).toBe(true);
    });

    it("returns error for non-existent email", async () => {
      const data = await rpc(
        "tools/call",
        { name: "cmail_delete_email", arguments: { email_id: "nope" } },
        token,
      );
      expect(data.result.isError).toBe(true);
    });
  });

  // ── tools/call: cmail_send_email ──────────────────────────────────────────

  describe("cmail_send_email", () => {
    it("returns error when required fields are missing", async () => {
      const data = await rpc(
        "tools/call",
        { name: "cmail_send_email", arguments: { to: "bob@test.com" } },
        token,
      );
      expect(data.result.isError).toBe(true);
    });
  });

  // ── tools/call: cmail_reply_email ─────────────────────────────────────────

  describe("cmail_reply_email", () => {
    it("returns error when required fields are missing", async () => {
      const data = await rpc(
        "tools/call",
        { name: "cmail_reply_email", arguments: {} },
        token,
      );
      expect(data.result.isError).toBe(true);
    });

    it("returns error when replying to non-existent email", async () => {
      const data = await rpc(
        "tools/call",
        {
          name: "cmail_reply_email",
          arguments: {
            email_id: "nope",
            body_html: "<p>reply</p>",
            from_address: "me@cmail.test",
          },
        },
        token,
      );
      expect(data.result.isError).toBe(true);
      expect(data.result.content[0].text).toContain("not found");
    });
  });

  // ── tools/call: unknown tool ──────────────────────────────────────────────

  describe("unknown tool", () => {
    it("returns error for unknown tool name", async () => {
      const data = await rpc(
        "tools/call",
        { name: "nonexistent_tool", arguments: {} },
        token,
      );
      expect(data.result.isError).toBe(true);
      expect(data.result.content[0].text).toContain("Unknown tool");
    });

    it("returns -32602 when tool name is missing", async () => {
      const data = await rpc("tools/call", { arguments: {} }, token);
      expect(data.error.code).toBe(-32602);
    });
  });
});
