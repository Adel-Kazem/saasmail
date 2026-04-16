import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { sql } from "drizzle-orm";
import { people } from "../db/people.schema";
import { emails } from "../db/emails.schema";
import { json200Response } from "../lib/helpers";
import type { Variables } from "../variables";

export const statsRouter = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Variables;
}>();

const StatsSchema = z.object({
  totalPeople: z.number(),
  totalEmails: z.number(),
  unreadCount: z.number(),
  recipients: z.array(z.string()),
});

const statsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Stats"],
  description: "Get inbox statistics.",
  request: {
    query: z.object({
      recipient: z
        .string()
        .optional()
        .openapi({ description: "Filter by recipient address" }),
    }),
  },
  responses: {
    ...json200Response(StatsSchema, "Inbox statistics"),
  },
});

statsRouter.openapi(statsRoute, async (c) => {
  const db = c.get("db");
  const { recipient } = c.req.valid("query");

  let totalEmails: number;
  let unreadCount: number;

  if (recipient) {
    const result = await db
      .select({
        total: sql<number>`COUNT(*)`,
        unread: sql<number>`SUM(CASE WHEN ${emails.isRead} = 0 THEN 1 ELSE 0 END)`,
      })
      .from(emails)
      .where(sql`${emails.recipient} = ${recipient}`);
    totalEmails = result[0]?.total ?? 0;
    unreadCount = result[0]?.unread ?? 0;
  } else {
    const result = await db
      .select({
        total: sql<number>`COUNT(*)`,
        unread: sql<number>`SUM(CASE WHEN ${emails.isRead} = 0 THEN 1 ELSE 0 END)`,
      })
      .from(emails);
    totalEmails = result[0]?.total ?? 0;
    unreadCount = result[0]?.unread ?? 0;
  }

  const personCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(people);

  const recipientRows = await db
    .select({ recipient: emails.recipient })
    .from(emails)
    .groupBy(emails.recipient);

  return c.json(
    {
      totalPeople: personCount[0]?.count ?? 0,
      totalEmails,
      unreadCount,
      recipients: recipientRows.map((r) => r.recipient),
    },
    200,
  );
});
