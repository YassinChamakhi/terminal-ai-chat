# terminal-ai-chat

A small terminal-based AI chat app built with Bun, the AI SDK, and OpenRouter.

It supports streaming responses in the terminal, simple chat memory, and a clean starting point for features like multiple sessions, `/model`, `/help`, and usage tracking.

## What it uses

- Bun runtime
- AI SDK
- OpenRouter as the model provider
- `chalk` for terminal styling
- `dotenv` for local environment variables

## Setup

1. Install dependencies:

```bash
bun install
```

2. Create your local env file:

```bash
copy .env.example .env
```

3. Add your OpenRouter API key to `.env`:

```bash
OPENROUTER_API_KEY=your_key_here
```

## Run

Start the chat app:

```bash
bun run chat.ts
```

## Project files

- [chat.ts](chat.ts) contains the terminal chat loop, streaming output, and chat history persistence.
- [provider.ts](provider.ts) loads the OpenRouter client from the environment.
- [chat-history.json](chat-history.json) is the local sample history file used by the app.
- [.env.example](.env.example) shows the required environment variable without exposing secrets.

## Notes

- If you want a fresh conversation, delete `chat-history.json` or use the `reset` command inside the app.
- Markdown rendering is intentionally avoided during streaming for now, because raw chunk output keeps the typing effect smooth.

## Future updates

- Typing indicator such as `AI is thinking...`
- Token and cost display from OpenRouter usage data
- `/model` switching
- Multiple chat sessions
- Better error handling
- `/help` command
