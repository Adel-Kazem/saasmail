import { describe, it, expect } from "vitest";
import { hashKey } from "../lib/crypto";

describe("hashKey", () => {
  it("returns a hex string of 64 characters (SHA-256)", async () => {
    const result = await hashKey("test-key");
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic", async () => {
    const a = await hashKey("same-input");
    const b = await hashKey("same-input");
    expect(a).toBe(b);
  });

  it("produces different hashes for different inputs", async () => {
    const a = await hashKey("key-1");
    const b = await hashKey("key-2");
    expect(a).not.toBe(b);
  });

  it("handles empty string", async () => {
    const result = await hashKey("");
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it("handles special characters", async () => {
    const result = await hashKey("sk_abc123!@#$%^&*()");
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });
});
