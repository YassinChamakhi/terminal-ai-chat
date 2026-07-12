type ModelRate = { promptRate: number; completionRate: number }; // $ per token

type OpenRouterModelsResponse = {
  data: Array<{
    id: string;
    pricing?: {
      prompt?: string;
      completion?: string;
    };
  }>;
};

let cache: Map<string, ModelRate> | null = null;
let cacheExpiresAt = 0;

const TTL_MS = 60 * 60 * 1000;        // 1 hour — normal refresh interval
const RETRY_TTL_MS = 5 * 60 * 1000;    // 5 minutes — shorter backoff after a failed fetch

async function fetchPricingTable(): Promise<Map<string, ModelRate>> {
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    signal: AbortSignal.timeout(5000), // don't hang the app on a slow/dead endpoint
  });
  if (!res.ok) {
    throw new Error(`OpenRouter /models fetch failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as OpenRouterModelsResponse;
  const table = new Map<string, ModelRate>();
  for (const m of data.data) {
    const prompt = parseFloat(m.pricing?.prompt ?? "0");
    const completion = parseFloat(m.pricing?.completion ?? "0");
    if (!Number.isFinite(prompt) || !Number.isFinite(completion)) continue; // skip malformed entries
    table.set(m.id, { promptRate: prompt, completionRate: completion });
  }
  return table;
}


export async function getRate(modelId: string): Promise<ModelRate | null> {
  const now = Date.now();

  if (!cache || now > cacheExpiresAt) {
    try {
      const freshTable = await fetchPricingTable();
      cache = freshTable;
      cacheExpiresAt = now + TTL_MS;
    } catch {
      if (!cache) return null; 
      cacheExpiresAt = now + RETRY_TTL_MS;
    }
  }

  const table = cache;
  return table ? (table.get(modelId) ?? null) : null;
}

/** Converts token usage + rate into integer microdollars (1e-6 USD). */
export function calculateCostMicros(rate: ModelRate, inputTokens: number, outputTokens: number): number {
  const dollars = inputTokens * rate.promptRate + outputTokens * rate.completionRate;
  return Math.round(dollars * 1_000_000);
}

/** Formats microdollars back to a human-readable $ string, e.g. "$0.000123" */
export function formatCostMicros(costMicros: number): string {
  return `$${(costMicros / 1_000_000).toFixed(6)}`;
}