import { nanoid } from "nanoid";

/**
 * Build an RFC 5322 Message-ID from a bare email address.
 * The returned value includes surrounding angle brackets, e.g. `<abc123@example.com>`.
 * Throws if `fromAddress` does not contain an `@` (callers must pass a plain address,
 * not a `"Display" <addr>` formatted string).
 */
export function generateMessageId(fromAddress: string): string {
  const at = fromAddress.lastIndexOf("@");
  if (at < 0) {
    throw new Error(`Invalid from address (missing @): ${fromAddress}`);
  }
  const domain = fromAddress.slice(at + 1);
  return `<${nanoid()}@${domain}>`;
}
