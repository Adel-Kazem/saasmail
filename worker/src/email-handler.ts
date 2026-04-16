import { drizzle } from "drizzle-orm/d1";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { schema } from "./db/schema";
import { people } from "./db/people.schema";
import { emails } from "./db/emails.schema";
import { attachments } from "./db/attachments.schema";
import { parseEmail } from "./lib/email-parser";
import { cancelSequencesForPerson } from "./lib/cancel-sequence";

export async function handleEmail(
  message: ForwardableEmailMessage,
  env: CloudflareBindings,
  ctx: ExecutionContext,
): Promise<void> {
  const db = drizzle(env.DB, { schema, logger: true });
  const parsed = await parseEmail(message);
  const now = Math.floor(Date.now() / 1000);

  // Deduplicate by Message-ID
  if (parsed.messageId) {
    const existing = await db
      .select({ id: emails.id })
      .from(emails)
      .where(eq(emails.messageId, parsed.messageId))
      .limit(1);
    if (existing.length > 0) {
      console.log(`Duplicate email with Message-ID: ${parsed.messageId}`);
      return;
    }
  }

  // Upsert person
  const personId = nanoid();
  await db
    .insert(people)
    .values({
      id: personId,
      email: parsed.from.address,
      name: parsed.from.name || null,
      lastEmailAt: now,
      unreadCount: 1,
      totalCount: 1,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: people.email,
      set: {
        name: sql`COALESCE(${parsed.from.name || null}, ${people.name})`,
        lastEmailAt: now,
        unreadCount: sql`${people.unreadCount} + 1`,
        totalCount: sql`${people.totalCount} + 1`,
        updatedAt: now,
      },
    });

  // Get the actual person ID (could be existing)
  const personRow = await db
    .select({ id: people.id })
    .from(people)
    .where(eq(people.email, parsed.from.address))
    .limit(1);
  const actualPersonId = personRow[0]!.id;

  // Process attachments first (need IDs for CID rewriting)
  const cidMap: Record<string, string> = {};
  const emailId = nanoid();

  for (const att of parsed.attachments) {
    const attachmentId = nanoid();
    const r2Key = `attachments/${emailId}/${att.filename}`;

    await env.R2.put(r2Key, att.content, {
      httpMetadata: { contentType: att.contentType },
    });

    await db.insert(attachments).values({
      id: attachmentId,
      emailId,
      filename: att.filename,
      contentType: att.contentType,
      size: att.content.byteLength,
      r2Key,
      contentId: att.contentId,
      createdAt: now,
    });

    if (att.contentId) {
      const cleanCid = att.contentId.replace(/^<|>$/g, "");
      cidMap[cleanCid] = attachmentId;
    }
  }

  // Rewrite CID references in HTML body
  let bodyHtml = parsed.bodyHtml;
  if (bodyHtml && Object.keys(cidMap).length > 0) {
    for (const [cid, attachmentId] of Object.entries(cidMap)) {
      bodyHtml = bodyHtml.replace(
        new RegExp(`cid:${cid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gi"),
        `/api/attachments/${attachmentId}/inline`,
      );
    }
  }

  // Insert email (with rewritten HTML)
  await db.insert(emails).values({
    id: emailId,
    personId: actualPersonId,
    recipient: parsed.to,
    subject: parsed.subject,
    bodyHtml,
    bodyText: parsed.bodyText,
    rawHeaders: JSON.stringify(parsed.headers),
    messageId: parsed.messageId,
    isRead: 0,
    receivedAt: now,
    createdAt: now,
  });

  // Cancel any active sequences for this person
  await cancelSequencesForPerson(db, actualPersonId);

  console.log(
    `Processed email from ${parsed.from.address} to ${parsed.to} (${parsed.attachments.length} attachments)`,
  );
}
