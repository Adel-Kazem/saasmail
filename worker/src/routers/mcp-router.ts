import { Hono } from "hono";
import { eq, like, desc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { Resend } from "resend";
import { getOAuthSession } from "../auth";
import { people } from "../db/people.schema";
import { emails } from "../db/emails.schema";
import { sentEmails } from "../db/sent-emails.schema";
import { cancelSequencesForPerson } from "../lib/cancel-sequence";
import { deleteEmailWithAttachments } from "../lib/delete-email";
import { injectDb } from "../db/middleware";
import type { Variables } from "../variables";
import type { DrizzleD1Database } from "drizzle-orm/d1";

export const mcpRouter = new Hono<{
  Bindings: CloudflareBindings;
  Variables: Variables;
}>();

// Inject DB for MCP routes (since they bypass /api/* middleware)
mcpRouter.use("*", injectDb);

// ─── JSON-RPC helpers ─────────────────────────────────────────────────────────
type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

function jsonRpcResult(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message, ...(data !== undefined ? { data } : {}) },
  };
}

// ─── Tool definitions ─────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: "cmail_list_people",
    description:
      "List email contacts/people with optional search. Returns each person with id, email, name, unread count, and last email timestamp. Use this to discover people before reading their emails.",
    annotations: { readOnlyHint: true, title: "List People" },
    inputSchema: {
      type: "object",
      properties: {
        q: {
          type: "string",
          description:
            "Optional search query to filter people by email address.",
        },
        page: {
          type: "number",
          description: "Page number (default 1).",
        },
        limit: {
          type: "number",
          description: "Results per page (default 50).",
        },
      },
      required: [],
    },
  },
  {
    name: "cmail_get_person",
    description:
      "Get details for a single person by ID. Returns the person's email, name, unread/total counts, and timestamps.",
    annotations: { readOnlyHint: true, title: "Get Person" },
    inputSchema: {
      type: "object",
      properties: {
        person_id: {
          type: "string",
          description: "The ID of the person to retrieve.",
        },
      },
      required: ["person_id"],
    },
  },
  {
    name: "cmail_list_emails",
    description:
      "List all emails (received and sent) for a given person. Returns a chronologically sorted array combining received and sent emails.",
    annotations: { readOnlyHint: true, title: "List Emails for Person" },
    inputSchema: {
      type: "object",
      properties: {
        person_id: {
          type: "string",
          description: "The person ID whose emails to list.",
        },
        page: { type: "number", description: "Page number (default 1)." },
        limit: {
          type: "number",
          description: "Results per page (default 50).",
        },
      },
      required: ["person_id"],
    },
  },
  {
    name: "cmail_read_email",
    description:
      "Read a single email with its full body. Works for both received and sent emails.",
    annotations: { readOnlyHint: true, title: "Read Email" },
    inputSchema: {
      type: "object",
      properties: {
        email_id: {
          type: "string",
          description: "The ID of the email to read.",
        },
      },
      required: ["email_id"],
    },
  },
  {
    name: "cmail_send_email",
    description:
      "Compose and send a new email to a recipient. Provide the recipient address, subject, and HTML body.",
    annotations: { readOnlyHint: false, title: "Send Email" },
    inputSchema: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "Recipient email address.",
        },
        subject: {
          type: "string",
          description: "Email subject line.",
        },
        body_html: {
          type: "string",
          description: "Email body as HTML.",
        },
        body_text: {
          type: "string",
          description: "Optional plain-text version of the email body.",
        },
        from_address: {
          type: "string",
          description: "The sender email address to send from.",
        },
      },
      required: ["to", "subject", "body_html", "from_address"],
    },
  },
  {
    name: "cmail_reply_email",
    description:
      "Reply to a received email. The reply is sent to the original sender with the correct In-Reply-To header.",
    annotations: { readOnlyHint: false, title: "Reply to Email" },
    inputSchema: {
      type: "object",
      properties: {
        email_id: {
          type: "string",
          description: "The ID of the received email to reply to.",
        },
        body_html: {
          type: "string",
          description: "Reply body as HTML.",
        },
        body_text: {
          type: "string",
          description: "Optional plain-text version of the reply body.",
        },
        from_address: {
          type: "string",
          description: "The sender email address to send from.",
        },
      },
      required: ["email_id", "body_html", "from_address"],
    },
  },
  {
    name: "cmail_mark_email",
    description: "Mark an email as read or unread.",
    annotations: { readOnlyHint: false, title: "Mark Email Read/Unread" },
    inputSchema: {
      type: "object",
      properties: {
        email_id: {
          type: "string",
          description: "The ID of the email to update.",
        },
        is_read: {
          type: "boolean",
          description: "Set to true to mark as read, false for unread.",
        },
      },
      required: ["email_id", "is_read"],
    },
  },
  {
    name: "cmail_delete_email",
    description:
      "Delete an email (received or sent) by its ID. This action cannot be undone.",
    annotations: { readOnlyHint: false, title: "Delete Email" },
    inputSchema: {
      type: "object",
      properties: {
        email_id: {
          type: "string",
          description: "The ID of the email to delete.",
        },
      },
      required: ["email_id"],
    },
  },
] as const;

// ─── Tool implementations ─────────────────────────────────────────────────────
type Db = DrizzleD1Database<any>;

class McpToolError extends Error {}

async function listPeople(db: Db, args: Record<string, unknown>) {
  const q = args.q as string | undefined;
  const page = Number(args.page ?? 1);
  const limit = Number(args.limit ?? 50);
  const offset = (page - 1) * limit;

  let rows;
  if (q) {
    const escaped = q.replace(/[%_\\]/g, "\\$&");
    rows = await db
      .select()
      .from(people)
      .where(sql`${people.email} LIKE ${"%" + escaped + "%"} ESCAPE '\\'`)
      .orderBy(desc(people.lastEmailAt))
      .limit(limit)
      .offset(offset);
  } else {
    rows = await db
      .select()
      .from(people)
      .orderBy(desc(people.lastEmailAt))
      .limit(limit)
      .offset(offset);
  }
  return rows;
}

async function getPerson(db: Db, args: Record<string, unknown>) {
  const id = args.person_id as string;
  if (!id) throw new McpToolError("person_id is required");

  const rows = await db
    .select()
    .from(people)
    .where(eq(people.id, id))
    .limit(1);

  if (rows.length === 0) throw new McpToolError("Person not found");
  return rows[0];
}

async function listEmails(db: Db, args: Record<string, unknown>) {
  const personId = args.person_id as string;
  if (!personId) throw new McpToolError("person_id is required");

  const page = Number(args.page ?? 1);
  const limit = Number(args.limit ?? 50);
  const offset = (page - 1) * limit;

  const received = await db
    .select()
    .from(emails)
    .where(eq(emails.personId, personId))
    .orderBy(emails.receivedAt)
    .limit(limit)
    .offset(offset);

  const sent = await db
    .select()
    .from(sentEmails)
    .where(eq(sentEmails.personId, personId))
    .orderBy(sentEmails.sentAt)
    .limit(limit)
    .offset(offset);

  const combined = [
    ...received.map((e) => ({ ...e, type: "received" as const })),
    ...sent.map((e) => ({ ...e, type: "sent" as const })),
  ].sort((a, b) => {
    const aTime = "receivedAt" in a ? a.receivedAt : a.sentAt;
    const bTime = "receivedAt" in b ? b.receivedAt : b.sentAt;
    return bTime - aTime;
  });

  return combined;
}

async function readEmail(db: Db, args: Record<string, unknown>) {
  const id = args.email_id as string;
  if (!id) throw new McpToolError("email_id is required");

  const received = await db
    .select()
    .from(emails)
    .where(eq(emails.id, id))
    .limit(1);
  if (received.length > 0) return { ...received[0], type: "received" };

  const sent = await db
    .select()
    .from(sentEmails)
    .where(eq(sentEmails.id, id))
    .limit(1);
  if (sent.length > 0) return { ...sent[0], type: "sent" };

  throw new McpToolError("Email not found");
}

async function sendEmail(
  db: Db,
  env: CloudflareBindings,
  args: Record<string, unknown>,
) {
  const to = args.to as string;
  const subject = args.subject as string;
  const bodyHtml = args.body_html as string;
  const bodyText = args.body_text as string | undefined;
  const fromAddress = args.from_address as string;

  if (!to || !subject || !bodyHtml || !fromAddress) {
    throw new McpToolError(
      "to, subject, body_html, and from_address are required",
    );
  }

  const now = Math.floor(Date.now() / 1000);

  const resend = new Resend(env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: fromAddress,
    to,
    subject,
    html: bodyHtml,
    text: bodyText,
  });

  const existingPerson = await db
    .select({ id: people.id })
    .from(people)
    .where(eq(people.email, to))
    .limit(1);

  const personId = existingPerson[0]?.id ?? null;

  const id = nanoid();
  await db.insert(sentEmails).values({
    id,
    personId,
    fromAddress,
    toAddress: to,
    subject,
    bodyHtml,
    bodyText: bodyText ?? null,
    resendId: result.data?.id ?? null,
    status: result.error ? "failed" : "sent",
    sentAt: now,
    createdAt: now,
  });

  if (personId) {
    await cancelSequencesForPerson(db, personId);
  }

  return { id, status: result.error ? "failed" : "sent" };
}

async function replyEmail(
  db: Db,
  env: CloudflareBindings,
  args: Record<string, unknown>,
) {
  const emailId = args.email_id as string;
  const bodyHtml = args.body_html as string;
  const bodyText = args.body_text as string | undefined;
  const fromAddress = args.from_address as string;

  if (!emailId || !bodyHtml || !fromAddress) {
    throw new McpToolError(
      "email_id, body_html, and from_address are required",
    );
  }

  const now = Math.floor(Date.now() / 1000);

  const original = await db
    .select()
    .from(emails)
    .where(eq(emails.id, emailId))
    .limit(1);
  if (original.length === 0) throw new McpToolError("Email not found");

  const orig = original[0];
  const person = await db
    .select({ email: people.email })
    .from(people)
    .where(eq(people.id, orig.personId))
    .limit(1);
  if (person.length === 0) throw new McpToolError("Person not found");

  const toAddress = person[0].email;
  const subject = orig.subject?.startsWith("Re: ")
    ? orig.subject
    : `Re: ${orig.subject || ""}`;

  const resend = new Resend(env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: fromAddress,
    to: toAddress,
    subject,
    html: bodyHtml,
    text: bodyText,
    headers: orig.messageId ? { "In-Reply-To": orig.messageId } : undefined,
  });

  const id = nanoid();
  await db.insert(sentEmails).values({
    id,
    personId: orig.personId,
    fromAddress,
    toAddress,
    subject,
    bodyHtml,
    bodyText: bodyText ?? null,
    inReplyTo: orig.messageId,
    resendId: result.data?.id ?? null,
    status: result.error ? "failed" : "sent",
    sentAt: now,
    createdAt: now,
  });

  await cancelSequencesForPerson(db, orig.personId);

  return { id, status: result.error ? "failed" : "sent" };
}

async function markEmail(db: Db, args: Record<string, unknown>) {
  const id = args.email_id as string;
  const isRead = args.is_read as boolean;

  if (!id || typeof isRead !== "boolean") {
    throw new McpToolError("email_id and is_read are required");
  }

  await db
    .update(emails)
    .set({ isRead: isRead ? 1 : 0 })
    .where(eq(emails.id, id));

  return { success: true };
}

async function deleteEmail(
  db: Db,
  env: CloudflareBindings,
  args: Record<string, unknown>,
) {
  const id = args.email_id as string;
  if (!id) throw new McpToolError("email_id is required");

  const result = await deleteEmailWithAttachments(db, env.R2, id);
  if (!result) throw new McpToolError("Email not found");
  return result;
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
  db: Db,
  env: CloudflareBindings,
) {
  switch (name) {
    case "cmail_list_people":
      return listPeople(db, args);
    case "cmail_get_person":
      return getPerson(db, args);
    case "cmail_list_emails":
      return listEmails(db, args);
    case "cmail_read_email":
      return readEmail(db, args);
    case "cmail_send_email":
      return sendEmail(db, env, args);
    case "cmail_reply_email":
      return replyEmail(db, env, args);
    case "cmail_mark_email":
      return markEmail(db, args);
    case "cmail_delete_email":
      return deleteEmail(db, env, args);
    default:
      throw new McpToolError(`Unknown tool: ${name}`);
  }
}

// ─── JSON-RPC dispatcher ──────────────────────────────────────────────────────
async function handleRpcMessage(
  msg: JsonRpcRequest,
  db: Db,
  env: CloudflareBindings,
): Promise<JsonRpcResponse | null> {
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return jsonRpcError(msg?.id ?? null, -32600, "Invalid Request");
  }

  const id = msg.id ?? null;
  const isNotification = msg.id === undefined || msg.id === null;

  try {
    switch (msg.method) {
      case "initialize":
        return jsonRpcResult(id, {
          protocolVersion: "2025-06-18",
          capabilities: { tools: { listChanged: false } },
          serverInfo: {
            name: "cmail",
            title: "cmail",
            version: "0.1.0",
            description:
              "MCP server for cmail — read, send, and manage emails. Exposes tools to list people, browse email threads, compose new messages, and manage your inbox.",
          },
        });

      case "notifications/initialized":
      case "notifications/cancelled":
        return null;

      case "resources/list":
        return jsonRpcResult(id, { resources: [] });

      case "prompts/list":
        return jsonRpcResult(id, { prompts: [] });

      case "ping":
        return jsonRpcResult(id, {});

      case "tools/list":
        return jsonRpcResult(id, { tools: TOOLS });

      case "tools/call": {
        const params = (msg.params ?? {}) as {
          name?: string;
          arguments?: Record<string, unknown>;
        };
        if (typeof params.name !== "string") {
          return jsonRpcError(id, -32602, "Invalid params: missing tool name");
        }
        try {
          const result = await callTool(
            params.name,
            params.arguments ?? {},
            db,
            env,
          );
          return jsonRpcResult(id, {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          });
        } catch (err) {
          const message =
            err instanceof McpToolError ? err.message : "Tool execution failed";
          return jsonRpcResult(id, {
            isError: true,
            content: [{ type: "text", text: message }],
          });
        }
      }

      default:
        if (isNotification) return null;
        return jsonRpcError(id, -32601, `Method not found: ${msg.method}`);
    }
  } catch (err) {
    return jsonRpcError(
      id,
      -32000,
      err instanceof Error ? err.message : "Internal error",
    );
  }
}

// ─── Route handlers ───────────────────────────────────────────────────────────
function unauthorizedResponse(baseUrl: string | undefined): Response {
  return new Response(null, {
    status: 401,
    headers: {
      "WWW-Authenticate": `Bearer resource_metadata="${baseUrl ?? ""}/.well-known/oauth-protected-resource"`,
    },
  });
}

mcpRouter.post("/", async (c) => {
  const db = c.get("db");
  const session = await getOAuthSession(db, c.req.raw.headers);
  if (!session) return unauthorizedResponse(c.env.BASE_URL);

  let body: JsonRpcRequest | JsonRpcRequest[];
  try {
    body = await c.req.json();
  } catch {
    return c.json(jsonRpcError(null, -32700, "Parse error"), 400);
  }

  if (Array.isArray(body)) {
    const responses = (
      await Promise.all(body.map((m) => handleRpcMessage(m, db, c.env)))
    ).filter((r): r is JsonRpcResponse => r !== null);
    if (responses.length === 0) return new Response(null, { status: 202 });
    return c.json(responses);
  }

  const response = await handleRpcMessage(body, db, c.env);
  if (response === null) return new Response(null, { status: 202 });
  return c.json(response);
});

// MCP streamable-HTTP clients may send a GET to open an SSE stream. We
// implement stateless request/response over POST, so signal that the server
// does not offer SSE.
mcpRouter.get("/", (c) => {
  return c.body(null, 405, { Allow: "POST" });
});
