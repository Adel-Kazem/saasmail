import { eq, inArray, sql, SQL } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { AnyColumn } from "drizzle-orm";
import { inboxPermissions } from "../db/inbox-permissions.schema";

export type AllowedInboxes =
  | { isAdmin: true }
  | { isAdmin: false; inboxes: string[] };

export async function resolveAllowedInboxes(
  db: DrizzleD1Database<any>,
  user: { id: string; role: string | null },
): Promise<AllowedInboxes> {
  if (user.role === "admin") {
    return { isAdmin: true };
  }
  const rows = await db
    .select({ email: inboxPermissions.email })
    .from(inboxPermissions)
    .where(eq(inboxPermissions.userId, user.id));
  return { isAdmin: false, inboxes: rows.map((r) => r.email) };
}

export function inboxFilter(
  allowed: AllowedInboxes,
  column: AnyColumn,
): SQL | undefined {
  if (allowed.isAdmin) return undefined;
  if (allowed.inboxes.length === 0) return sql`0`;
  return inArray(column, allowed.inboxes);
}

export function assertInboxAllowed(
  allowed: AllowedInboxes,
  email: string,
): void {
  if (allowed.isAdmin) return;
  if (!allowed.inboxes.includes(email)) {
    throw new HTTPException(403, { message: "Inbox not allowed" });
  }
}
