import { streamText, type ModelMessage } from "ai";
import { model, DEFAULT_MODEL_ID } from "./provider";
import { getRate, calculateCostMicros } from "./pricing";
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

    const usage = await titleResult.usage;
    const rate = usage ? await getRate(DEFAULT_MODEL_ID) : null; // fixed model, on purpose — title cost stays predictable even after /model switches
    const cost = rate && usage ? calculateCostMicros(rate, usage.inputTokens ?? 0, usage.outputTokens ?? 0) : undefined;

    db.update(sessions).set({
      ...(cleanTitle ? { title: cleanTitle } : {}),
      titleInputTokens: usage?.inputTokens,
      titleOutputTokens: usage?.outputTokens,
      titleCost: cost,
    }).where(eq(sessions.id, sessionId)).run();
  } catch {
    // Title generation failing must never break the chat
  }
}