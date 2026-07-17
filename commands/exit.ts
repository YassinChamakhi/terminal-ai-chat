import chalk from "chalk";
import type { Command } from "./types";

export const exitCommand: Command = {
  name: "/exit",
  description: "End the session",
  handler: async () => {
    console.log(chalk.yellow("\nGoodbye 👋\n"));
    return "exit";
  },
};