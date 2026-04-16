import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { senderIdentities } from "../db/sender-identities.schema";
import { json200Response } from "../lib/helpers";
import type { Variables } from "../variables";

export const senderIdentitiesRouter = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Variables;
}>();

const SenderIdentitySchema = z.object({
  email: z.string().email(),
  displayName: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

// GET /api/sender-identities — list all
const listRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Sender Identities"],
  description: "List all sender identities.",
  responses: {
    ...json200Response(z.array(SenderIdentitySchema), "Sender identities"),
  },
});

senderIdentitiesRouter.openapi(listRoute, async (c) => {
  const db = c.get("db");
  const rows = await db.select().from(senderIdentities);
  return c.json(rows, 200);
});

// PUT /api/sender-identities/:email — upsert
const upsertRoute = createRoute({
  method: "put",
  path: "/{email}",
  tags: ["Sender Identities"],
  description: "Set display name for a sender email address.",
  request: {
    params: z.object({ email: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({ displayName: z.string().min(1) }),
        },
      },
    },
  },
  responses: {
    ...json200Response(SenderIdentitySchema, "Sender identity saved"),
  },
});

senderIdentitiesRouter.openapi(upsertRoute, async (c) => {
  const db = c.get("db");
  const { email } = c.req.valid("param");
  const { displayName } = c.req.valid("json");
  const now = Math.floor(Date.now() / 1000);

  await db
    .insert(senderIdentities)
    .values({ email, displayName, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: senderIdentities.email,
      set: { displayName, updatedAt: now },
    });

  const rows = await db
    .select()
    .from(senderIdentities)
    .where(eq(senderIdentities.email, email))
    .limit(1);

  return c.json(rows[0], 200);
});

// DELETE /api/sender-identities/:email
const deleteRoute = createRoute({
  method: "delete",
  path: "/{email}",
  tags: ["Sender Identities"],
  description: "Remove display name for a sender email address.",
  request: {
    params: z.object({ email: z.string() }),
  },
  responses: {
    ...json200Response(z.object({ success: z.boolean() }), "Deleted"),
  },
});

senderIdentitiesRouter.openapi(deleteRoute, async (c) => {
  const db = c.get("db");
  const { email } = c.req.valid("param");
  await db.delete(senderIdentities).where(eq(senderIdentities.email, email));
  return c.json({ success: true }, 200);
});
