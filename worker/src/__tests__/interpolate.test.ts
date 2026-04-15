import { describe, it, expect } from "vitest";
import { interpolate } from "../lib/interpolate";

describe("interpolate", () => {
  it("replaces known variables", () => {
    expect(interpolate("Hello {{name}}", { name: "Alice" })).toBe(
      "Hello Alice",
    );
  });

  it("replaces multiple variables", () => {
    expect(
      interpolate("Hi {{name}}, your email is {{email}}", {
        name: "Bob",
        email: "bob@test.com",
      }),
    ).toBe("Hi Bob, your email is bob@test.com");
  });

  it("leaves unmatched tokens as-is", () => {
    expect(interpolate("Hello {{name}}, {{unknown}}", { name: "Alice" })).toBe(
      "Hello Alice, {{unknown}}",
    );
  });

  it("handles empty variables", () => {
    expect(interpolate("Hello {{name}}", {})).toBe("Hello {{name}}");
  });

  it("handles empty template", () => {
    expect(interpolate("", { name: "Alice" })).toBe("");
  });

  it("replaces variable with empty string", () => {
    expect(interpolate("Hello {{name}}!", { name: "" })).toBe("Hello !");
  });

  it("handles multiple occurrences of same variable", () => {
    expect(interpolate("{{x}} and {{x}}", { x: "hi" })).toBe("hi and hi");
  });

  it("only matches word characters inside braces", () => {
    expect(interpolate("{{not-a-var}}", { "not-a-var": "nope" })).toBe(
      "{{not-a-var}}",
    );
  });
});
