import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { users } from "./auth.schema";

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    keyHash: text("key_hash").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("api_keys_key_hash_idx").on(table.keyHash)],
);
