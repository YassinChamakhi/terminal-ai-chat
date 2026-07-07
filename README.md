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
bun run chat.ts use <id>    # resume a specific session by id
bun run chat.ts sessions    # list recent sessions
```

Type `exit` to quit. The first message in a new session is used to auto-generate a short session title.

## Project Structure

- `chat.ts` — terminal chat loop, session handling, streaming output
- `provider.ts` — OpenRouter client setup
- `db/`
  - `index.ts` — SQLite connection (WAL mode, foreign keys, Drizzle setup)
  - `schema.ts` — `sessions` and `messages` table definitions
  - `queries.ts` — session/message CRUD + startup recovery
- `drizzle.config.ts` — Drizzle Kit config

Sessions and messages are persisted in SQLite rather than a flat file — each session tracks an id, title, and timestamps, and each message tracks its role, content, token usage, cost, and status (`pending` / `complete` / `interrupted`), so history survives restarts and crashes cleanly.

## Notes

- `chat-history.json` is a leftover from the old JSON-based version and is no longer used by the app 

## Future Updates

- [ ] `/model` switching
- [ ] Conversation search
- [ ] Better error handling around interrupted streams
- [ ] Terminal UI overhaul with [Ink](https://github.com/vadimdemedes/ink)