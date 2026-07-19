import { db } from "./index";
import { sessions, messages } from "./schema";
import { eq, desc, asc, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";

// ── Sessions ──────────────────────────────

export function createSession(title?: string): string {
  const id = randomUUID();
  const now = Date.now();
  db.insert(sessions).values({
    id,
    title: title ?? "New session",
    createdAt: now,
    updatedAt: now,
  }).run();
  return id;
}

export function getSession(id: string) {
  return db.select().from(sessions).where(eq(sessions.id, id)).get();
}

export function listSessions(limit = 10) {
  return db.select().from(sessions).orderBy(desc(sessions.updatedAt)).limit(limit).all();
}

export function touchSession(id: string) {
  db.update(sessions).set({ updatedAt: Date.now() }).where(eq(sessions.id, id)).run();
}

// ── Messages ──────────────────────────────

export function getMessages(sessionId: string) {
  return db.select().from(messages).where(eq(messages.sessionId, sessionId)).orderBy(asc(messages.createdAt)).all();
}

export function addMessage(sessionId: string, role: string, content: string): string {
  const id = randomUUID();
  db.insert(messages).values({
    id,
    sessionId,
    role,
    content,
    status: role === "assistant" ? "pending" : "complete",
    completedAt: role === "assistant" ? null : Date.now(),
    createdAt: Date.now(),
  }).run();

  touchSession(sessionId);  

  return id;
}

export function completeMessage(messageId: string, content: string, inputTokens?: number, outputTokens?: number, cost?: number, model?: string) {
  db.update(messages).set({
    content,
    status: "complete",
    completedAt: Date.now(),
    inputTokens,
    outputTokens,
    cost,
    model,
  }).where(eq(messages.id, messageId)).run();
}

// ── Startup recovery ──────────────────────

export function markOrphanedInterrupted() {
  db.update(messages)
    .set({ status: "interrupted" })
    .where(isNull(messages.completedAt))
    .run();
}