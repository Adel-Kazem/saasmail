import { eq } from "drizzle-orm";
import { senderIdentities } from "../db/sender-identities.schema";
import type { DrizzleD1Database } from "drizzle-orm/d1";

/**
 * Looks up the display name for an email address and returns
 * a formatted "From" string for the Resend API.
 *
 * Returns "Display Name <email>" if a display name is configured,
 * otherwise returns the bare email address.
 */
export async function formatFromAddress(
  db: DrizzleD1Database<any>,
  email: string,
): Promise<string> {
  const rows = await db
    .select({ displayName: senderIdentities.displayName })
    .from(senderIdentities)
    .where(eq(senderIdentities.email, email))
    .limit(1);

  if (rows.length > 0 && rows[0].displayName) {
    return `${rows[0].displayName} <${email}>`;
  }
  return email;
}
