# terminal-ai-chat

A terminal-based AI chat app with persistent, multi-session history backed by SQLite. Built with Bun, the Vercel AI SDK, and OpenRouter — streaming responses, session management, and per-message token/cost tracking.

Session storage was migrated from a flat JSON file to a proper SQLite database (WAL mode, Drizzle ORM) for durability and multi-session support.

## Stack

Bun · Vercel AI SDK v7 · OpenRouter · Chalk · Drizzle ORM · SQLite (WAL mode) 

## Setup

```bash
bun install
cp .env.example .env   # add your OPENROUTER_API_KEY (get one at openrouter.ai)
```

The database (`chat.db`) is created automatically on first run.

## Usage

```bash
bun run chat.ts             # start a new session
bun run chat.ts continue    # resume the most recent session
bun run chat.ts sessions    # list recent sessions
```

Type `exit` to quit. The first message in a new session is used to auto-generate a short session title.

## Project Structure

- `chat.ts` — terminal chat loop, session handling, streaming output
- `provider.ts` — OpenRouter client setup, exports the active `MODEL_ID`
- `pricing.ts` — fetches and caches live per-model pricing from OpenRouter's `/models` endpoint, computes per-message cost in microdollars (1e-6 USD)
- `title.ts` — auto-generates a short session title from the first message
- `db/`
  - `index.ts` — SQLite connection (WAL mode, foreign keys, Drizzle setup)
  - `schema.ts` — `sessions` and `messages` table definitions
  - `queries.ts` — session/message CRUD + startup recovery
- `drizzle.config.ts` — Drizzle Kit config

Sessions and messages are persisted in SQLite rather than a flat file — each session tracks an id, title, and timestamps, and each message tracks its role, content, token usage, cost, model, and status (`pending` / `complete` / `interrupted`), so history survives restarts and crashes cleanly.

### Cost tracking

Pricing is pulled live from OpenRouter rather than hardcoded, since a static table silently goes stale and produces wrong historical costs. Rates are cached for an hour (5 minutes after a failed fetch, as a shorter retry backoff) to avoid hitting the endpoint on every message.

After each response, input/output tokens and cost are shown inline:

```
↳ 102 in · 15 out · $0.000024
```

If pricing can't be resolved (network issue, unknown model), `cost` is stored as `NULL` rather than `0` — an unknown cost should never be recorded as a free one. Each assistant message also stores which `model` generated it, so cost can later be broken down per model once `/model` switching is added.

## Future Updates
 
- [x] `/model` switching — see "Switching Models" below
- [ ] Second free-tier provider (Groq or Cerebras) — separate rate-limit pool from OpenRouter's free tier
- [ ] Terminal UI overhaul
- [ ] Conversation search
- [ ] Context window management for long sessions (currently the full message history is replayed every turn, with no truncation or summarization)


## Switching Models

Type `/model` mid-conversation to change which model answers: a numbered list of curated models (default, free, and premium options across OpenAI, Anthropic, Google, and DeepSeek), an option to type any exact OpenRouter model ID, or an option to back out and keep the current one.

The Free option automatically falls back across 3 candidate models if the first is rate-limited — handled server-side by OpenRouter, no manual retry needed. The model actually used is shown in the per-message cost line and stored per-message in the database.

Switching is sticky for the rest of the session and does not persist across sessions — exiting and running `continue` resets to the default model.

## Commands

Type `/help` anytime to see this list in the app.

- `/model` — switch which model answers (curated picker, custom slug entry, or back out)
- `/sessions` — list your 10 most recent sessions
- `/new [name]` — start a fresh session without exiting
- `/continue [id]` — resume your most recent session, or switch to a specific one by id
- `/exit` — end the session
- `/help` — show this command list