import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  brand: text("brand"),
  edition: text("edition"),
  year: text("year"),
  identifiers: text("identifiers"),
  vibes: text("vibes").array(),
  qty: integer("qty").default(1).notNull(),
  status: text("status").default("ACTIVE").notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
  ambientData: jsonb("ambient_data").$type<{
    ai_confidence?: number;
    year?: string | null;
    edition?: string | null;
    vibes?: string[];
    [key: string]: any;
  }>(),
  imageUrl: text("image_url"),
});

export const insertItemSchema = createInsertSchema(items).omit({ 
  id: true, 
  addedAt: true 
});

export type Item = typeof items.$inferSelect;
export type InsertItem = z.infer<typeof insertItemSchema>;
