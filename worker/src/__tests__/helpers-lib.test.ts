import { describe, it, expect } from "vitest";
import { json200Response, json201Response } from "../lib/helpers";
import { z } from "zod";

describe("json200Response", () => {
  it("returns 200 response config", () => {
    const schema = z.object({ id: z.string() });
    const result = json200Response(schema, "Success");
    expect(result).toHaveProperty("200");
    expect(result[200].description).toBe("Success");
    expect(result[200].content["application/json"].schema).toBe(schema);
  });
});

describe("json201Response", () => {
  it("returns 201 response config", () => {
    const schema = z.object({ id: z.string() });
    const result = json201Response(schema, "Created");
    expect(result).toHaveProperty("201");
    expect(result[201].description).toBe("Created");
    expect(result[201].content["application/json"].schema).toBe(schema);
  });
});
