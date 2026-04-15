import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const sequences = sqliteTable("sequences", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  steps: text("steps").notNull(), // JSON: [{ order, templateSlug, delayHours }]
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
