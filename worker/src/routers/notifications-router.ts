import { Hono } from "hono";
import type { Variables } from "../variables";

export const notificationsRouter = new Hono<{
  Bindings: CloudflareBindings;
  Variables: Variables;
}>();

notificationsRouter.get("/stream", async (c) => {
  if (c.req.header("Upgrade") !== "websocket") {
    return c.json({ error: "Expected WebSocket upgrade" }, 426);
  }

  const user = c.get("user");
  const allowed = c.get("allowedInboxes");

  if (!user || !allowed) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.env.NOTIFICATIONS_HUB.idFromName("global");
  const stub = c.env.NOTIFICATIONS_HUB.get(id);

  return stub.fetch(
    new Request("http://do/connect", {
      headers: {
        Upgrade: "websocket",
        Connection: "Upgrade",
        "X-Is-Admin": allowed.isAdmin ? "true" : "false",
        "X-Allowed-Inboxes": allowed.isAdmin
          ? "[]"
          : JSON.stringify(allowed.inboxes),
      },
    }),
  );
});
