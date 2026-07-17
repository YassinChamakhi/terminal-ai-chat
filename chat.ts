import { streamText, type ModelMessage } from "ai";
import { model as defaultModel, DEFAULT_MODEL_ID, getModel, getModelWithFallback, CURATED_MODELS, FREE_TIER_ID, FREE_MODEL_CANDIDATES } from "./provider";
import { getRate, calculateCostMicros, formatCostMicros } from "./pricing";
import chalk from "chalk";
import {
  createSession,
  getSession,
  listSessions,
  getMessages,
  addMessage,
  completeMessage,
  markOrphanedInterrupted,
} from "./db/queries";
import { generateSessionTitle } from "./title";
import { commandRegistry } from "./commands/registry";
import type { CommandContext } from "./commands/types";

const SYSTEM_PROMPT = "You are a helpful, concise terminal assistant.";

process.on("uncaughtException", (err) => {
  console.log(chalk.red(`\n[Fatal error: ${err.message}]\n`));
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.log(chalk.red(`\n[Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}]\n`));
});


async function main() {

  if (!process.env.OPENROUTER_API_KEY) {
    console.log(chalk.red("\nMissing OPENROUTER_API_KEY in .env — add your OpenRouter key and try again.\n"));
    process.exit(1);
  }

  try {
    markOrphanedInterrupted();
  } catch (err) {
    console.log(chalk.red(`\nDatabase error on startup: ${err instanceof Error ? err.message : String(err)}\n`));
    process.exit(1);
  }

  const args = process.argv.slice(2);
  let sessionId: string;
  let isNewChat = false;

  try {
    if (args[0] === "continue") {
      const recent = listSessions(1);
      const mostrecent = recent[0];
      if (!mostrecent) {
        const name = prompt(chalk.cyan("Session name: ")) || "New session";
        sessionId = createSession(name);
        isNewChat = true;
      } else {
        sessionId = mostrecent.id;
      }
    } else if (args[0] === "use" && args[1]) {
      const target = getSession(args[1]);
      if (!target) {
        console.log(chalk.red(`No session found with id: ${args[1]}`));
        return;
      }
      sessionId = target.id;
    } else if (args[0] === "sessions") {
      const all = listSessions(10);
      console.log(chalk.cyan.bold("\nRecent sessions:\n"));
      all.forEach((s, i) => {
        console.log(`${i + 1}. ${s.title}  ${chalk.gray(new Date(s.updatedAt).toLocaleString())}`);
      });
      console.log();
      return;
    } else {
      sessionId = createSession();
      isNewChat = true;
    }
  } catch (err) {
    console.log(chalk.red(`\nFailed to start session: ${err instanceof Error ? err.message : String(err)}\n`));
    return;
  }

  // Model state — resets to default every run, on purpose (v1 scope, see README).
  let currentModelId = DEFAULT_MODEL_ID;
  let currentModel = defaultModel;

  console.log(chalk.cyan.bold("\n🤖 Terminal Chat — type 'exit' to quit\n"));
  console.log(chalk.dim(`Model: ${currentModelId}  ·  type /model to switch\n`));

  if (isNewChat) {
    console.log(chalk.magenta.bold("AI: ") + "Salam alaykom! How can I assist you today?\n");
  }

  const dbMessages = getMessages(sessionId);
  let messages: ModelMessage[] = dbMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  let titleGenerated = false;

  while (true) {
    const userInput = prompt(chalk.green.bold("You: "));
    if (!userInput || userInput.trim().toLowerCase() === "exit") {
      console.log(chalk.yellow("\nGoodbye 👋\n"));
      break;
    }

    const trimmed = userInput.trim();
    if (trimmed.startsWith("/")) {
      const [rawCmd, ...rest] = trimmed.split(" ");
      if (!rawCmd) {
        continue; // shouldn't happen since trimmed starts with "/", but satisfies TS
      }
      const command = commandRegistry.find(c => c.name === rawCmd.toLowerCase());
      if (!command) {
        console.log(chalk.red(`\nUnknown command: ${rawCmd}. Type /help for available commands.\n`));
        continue;
      }
      const ctx: CommandContext = { sessionId, messages, currentModelId, isNewChat, titleGenerated };
      try {
        const result = await command.handler(rest.join(" "), ctx);
        sessionId = ctx.sessionId;
        messages = ctx.messages;
        currentModelId = ctx.currentModelId;
        isNewChat = ctx.isNewChat;
        titleGenerated = ctx.titleGenerated;
        currentModel = getModel(currentModelId);
        if (result === "exit") break;
      } catch (err) {
        console.log(chalk.red(`\n[Command failed: ${err instanceof Error ? err.message : String(err)}]\n`));
      }
      continue;
    }

    try {
      addMessage(sessionId, "user", userInput);
      messages.push({ role: "user", content: userInput });

      if (isNewChat && !titleGenerated && userInput.length > 0) {
        titleGenerated = true;
        generateSessionTitle(sessionId, userInput); // background, not awaited, self-contained error handling
      }

      process.stdout.write(chalk.magenta.bold("AI: "));
      const assistantMsgId = addMessage(sessionId, "assistant", "");

      const activeModel = currentModelId === FREE_TIER_ID
        ? getModelWithFallback(FREE_MODEL_CANDIDATES)
        : getModel(currentModelId);

      const result = streamText({
        model: activeModel,
        instructions: SYSTEM_PROMPT,
        messages,
        onError: ({ error }) => {
          console.log(chalk.red(`\n[Stream error: ${error instanceof Error ? error.message : String(error)}]`));
        },
      });

      let fullResponse = "";
      for await (const chunk of result.textStream) {
        process.stdout.write(chunk);
        fullResponse += chunk;
      }
      console.log("\n");

      const usage = await result.usage;
      const finalStep = await result.finalStep;
      const resolvedId = currentModelId === FREE_TIER_ID ? finalStep.response.modelId : currentModelId;
      const inputTokens = usage?.inputTokens ?? 0;
      const outputTokens = usage?.outputTokens ?? 0;

      let costMicros: number | undefined;
      const rate = await getRate(resolvedId);
      const costLabel = rate
        ? formatCostMicros((costMicros = calculateCostMicros(rate, inputTokens, outputTokens)))
        : "cost unknown";

      console.log(chalk.dim(` ↳ [${resolvedId} · ${inputTokens} in / ${outputTokens} out · ${costLabel}]\n`));

      completeMessage(assistantMsgId, fullResponse, inputTokens, outputTokens, costMicros, resolvedId);
      messages.push({ role: "assistant", content: fullResponse });

    } catch (err) {
      console.log(chalk.red(`\n[Something went wrong: ${err instanceof Error ? err.message : String(err)}]\n`));
      // Loop continues — one failed turn doesn't kill the app
    }
  }
}

main();