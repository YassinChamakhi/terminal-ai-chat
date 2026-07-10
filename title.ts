import { streamText, type ModelMessage } from "ai";
import { model } from "./provider";
import { db } from "./db";
import { sessions } from "./db/schema";
import { eq } from "drizzle-orm";

export async function generateSessionTitle(sessionId: string, firstMessage: string) {
  try {
    const titleMessages: ModelMessage[] = [
      { role: "user", content: `Generate a short 2-3 word title for this conversation topic: "${firstMessage.slice(0, 100)}". Reply with ONLY the title, nothing else.` }
    ];

    const titleResult = streamText({ model, messages: titleMessages });

    let generatedTitle = "";
    for await (const chunk of titleResult.textStream) {
      generatedTitle += chunk;
    }

    const cleanTitle = generatedTitle.trim().replace(/^["']|["']$/g, "").slice(0, 50);

    if (cleanTitle) {
      db.update(sessions).set({ title: cleanTitle }).where(eq(sessions.id, sessionId)).run();
    }
  } catch {
    
  }
}