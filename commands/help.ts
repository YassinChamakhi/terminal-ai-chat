import chalk from "chalk";
import type { Command } from "./types";
import { commandRegistry } from "./registry";

export const helpCommand: Command = {
  name: "/help",
  description: "List available commands",
  handler: async () => {
    console.log(chalk.cyan.bold("\nCommands:\n"));
    for (const cmd of commandRegistry) {
      console.log(`  ${cmd.name.padEnd(12)} ${cmd.description}`);
    }
    console.log();
  },
};