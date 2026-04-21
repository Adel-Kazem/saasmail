import { describe, it, expect } from "vitest";
import { generateMessageId } from "../lib/message-id";

describe("generateMessageId", () => {
  it("wraps a nanoid and domain in angle brackets", () => {
    const id = generateMessageId("alice@example.com");
    expect(id).toMatch(/^<[A-Za-z0-9_-]+@example\.com>$/);
  });

  it("uses the domain portion of a name+addr From (plain address expected)", () => {
    const id = generateMessageId("bob@sub.mail.example.co.uk");
    expect(id.endsWith("@sub.mail.example.co.uk>")).toBe(true);
  });

  it("produces different ids on successive calls", () => {
    const a = generateMessageId("x@y.com");
    const b = generateMessageId("x@y.com");
    expect(a).not.toBe(b);
  });

  it("throws if the address has no @", () => {
    expect(() => generateMessageId("not-an-address")).toThrow(/from address/i);
  });
});
