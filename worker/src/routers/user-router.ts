import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { passkeys } from "../db/auth.schema";
import { json200Response } from "../lib/helpers";
import type { Variables } from "../variables";

export const userRouter = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Variables;
}>();

const PasskeyStatusSchema = z.object({
  hasPasskey: z.boolean(),
});

const passkeyStatusRoute = createRoute({
  method: "get",
  path: "/passkeys",
  tags: ["User"],
  description: "Check if the current user has a registered passkey.",
  responses: {
    ...json200Response(PasskeyStatusSchema, "Passkey status"),
  },
});

userRouter.openapi(passkeyStatusRoute, async (c) => {
  const db = c.get("db");
  const user = c.get("user");

  const rows = await db
    .select()
    .from(passkeys)
    .where(eq(passkeys.userId, user.id))
    .limit(1);

  return c.json({ hasPasskey: rows.length > 0 }, 200);
});
