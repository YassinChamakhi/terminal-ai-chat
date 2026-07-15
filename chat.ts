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

const SYSTEM_PROMPT = "You are a helpful, concise terminal assistant.";

process.on("uncaughtException", (err) => {
  console.log(chalk.red(`\n[Fatal error: ${err.message}]\n`));
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.log(chalk.red(`\n[Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}]\n`));
});

// Shows the picker, lets the user pick a curated model, type a custom one, or back out.
// Regenerated fresh every call so "(current)" is always accurate.
async function handleModelCommand(currentModelId: string): Promise<string> {
  console.log(chalk.cyan.bold("\nSelect a model:\n"));
  CURATED_MODELS.forEach((m, i) => {
    const marker = m.id === currentModelId ? chalk.green(" (current)") : "";
    console.log(`${i + 1}. ${m.label}${marker}`);
  });
  const typeOption = CURATED_MODELS.length + 1;
  const backOption = CURATED_MODELS.length + 2;
  console.log(`${typeOption}. Type a model name you know (exact OpenRouter slug)`);
  console.log(`${backOption}. Back (keep current)\n`);

  const choice = prompt(chalk.cyan("Pick a number: "));
  const index = parseInt((choice ?? "").trim(), 10);

  if (!choice || Number.isNaN(index) || index === backOption) {
    console.log(chalk.yellow(`\nKept current model: ${currentModelId}\n`));
    return currentModelId;
  }

  if (index === typeOption) {
    const typed = (prompt(chalk.cyan("Model id (exact OpenRouter slug): ")) ?? "").trim();
    if (!typed) {
      console.log(chalk.yellow(`\nNo input, keeping current model: ${currentModelId}\n`));
      return currentModelId;
    }
    // Reuses the same cache pricing.ts already fetches — no second network call.
    const rate = await getRate(typed);
    if (!rate) {
      console.log(chalk.red(`\n"${typed}" was not found on OpenRouter. Keeping ${currentModelId}. Run /model again to retry.\n`));
      return currentModelId;
    }
    console.log(chalk.green(`\nSwitched to ${typed}\n`));
    return typed;
  }

  const picked = CURATED_MODELS[index - 1];
  if (!picked) {
    console.log(chalk.red(`\nInvalid selection, keeping current model: ${currentModelId}\n`));
    return currentModelId;
  }

  console.log(chalk.green(`\nSwitched to ${picked.label} (${picked.id})\n`));
  return picked.id;
}

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
  const messages: ModelMessage[] = dbMessages.map((m) => ({
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

    if (userInput.trim() === "/model") {
      currentModelId = await handleModelCommand(currentModelId);
      currentModel = getModel(currentModelId);
      continue; // never reaches addMessage/streamText — command, not a chat turn
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