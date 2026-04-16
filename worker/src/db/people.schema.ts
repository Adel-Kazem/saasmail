import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const people = sqliteTable(
  "people",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name"),
    lastEmailAt: integer("last_email_at").notNull(),
    unreadCount: integer("unread_count").notNull().default(0),
    totalCount: integer("total_count").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("people_last_email_at_idx").on(table.lastEmailAt)],
);
