import { sqliteTable, text, integer} from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default("local-user"),
  title: text("title"),
  createdAt: integer("created_at").notNull().default(0),
  updatedAt: integer("updated_at").notNull().default(0),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  cost: integer("cost"), // microdollars (1e-6 USD) — see pricing.ts
  model: text("model"), // e.g. "openai/gpt-4o-mini" — which model generated this response
  status: text("status").notNull().default("complete"),
  completedAt: integer("completed_at"),
  createdAt: integer("created_at").notNull().default(0),
});