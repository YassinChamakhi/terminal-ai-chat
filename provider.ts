import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import "dotenv/config";

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const DEFAULT_MODEL_ID = "openai/gpt-4o-mini"; // default — also used by title.ts, kept intentionally fixed there
export const model = openrouter(DEFAULT_MODEL_ID);     // still exported so title.ts doesn't need to change

export function getModel(modelId: string) {
  return openrouter(modelId);
}

export function getModelWithFallback(candidateIds: string[]) {
  const primary = candidateIds[0];
  if (!primary) {
    throw new Error("getModelWithFallback: candidateIds must not be empty");
  }
  return openrouter(primary, {
    extraBody: { models: candidateIds },
  });
}

export type CuratedModel = { id: string; label: string };

// Sentinel — not a real OpenRouter slug. chat.ts special-cases this id
// and tries each entry in FREE_MODEL_CANDIDATES in order until one works.
export const FREE_TIER_ID = "auto:free";

// Order = priority. First is tried first. Verify each via getRate() before
// trusting it — availability rotates and this is exactly the kind of list
// that goes stale silently.
export const FREE_MODEL_CANDIDATES = [
  "openai/gpt-oss-20b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
];

export const CURATED_MODELS: CuratedModel[] = [
  // DEFAULT
  { id: DEFAULT_MODEL_ID, label: "GPT-4o Mini (Default)" },
  // FREE
  { id: FREE_TIER_ID, label: "OpenRouter Free (auto-fallback, lower quality)" },  
  // PREMIUM
  { id: "openai/gpt-5.5", label: "GPT-5.5 (Premium)" },
  { id: "anthropic/claude-opus-4.8", label: "Claude Opus 4.8 (Premium)" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (Premium)" },
  { id: "deepseek/deepseek-v4-pro", label: "DeepSeek V4 Pro (Premium)" },
];
