import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import "dotenv/config";

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const MODEL_ID = "openai/gpt-4o-mini";
export const model = openrouter(MODEL_ID);