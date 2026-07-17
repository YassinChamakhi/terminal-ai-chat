import { getModel, CURATED_MODELS } from "../provider";
import { getRate } from "../pricing";
import chalk from "chalk";
import type { Command } from "./types";

async function pickModel(currentModelId: string): Promise<string> {
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

export const modelCommand: Command = {
  name: "/model",
  description: "Switch which model answers",
  handler: async (_arg, ctx) => {
    ctx.currentModelId = await pickModel(ctx.currentModelId);
  },
};