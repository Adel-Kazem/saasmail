import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { AllowedInboxes } from "./lib/inbox-permissions";

export type Variables = {
  user?: any;
  db: DrizzleD1Database<any>;
  allowedInboxes?: AllowedInboxes;
  // How the current request was authenticated. Used by middleware to decide
  // whether to enforce passkey checks (apiKey requests bypass, since issuance
  // itself is gated on passkey presence).
  authMethod?: "session" | "apiKey";
};
