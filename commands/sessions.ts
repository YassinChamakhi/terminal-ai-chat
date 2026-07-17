import chalk from "chalk";
import type { Command } from "./types";
import { listSessions, getSession, getMessages, createSession } from "../db/queries";
import type { ModelMessage } from "ai";

export const sessionsCommand: Command = {
  name: "/sessions",
  description: "List recent sessions",
  handler: async () => {
    const all = listSessions(10);
    if (all.length === 0) {
      console.log(chalk.yellow("\nNo sessions yet.\n"));
      return;
    }
    console.log(chalk.cyan.bold("\nRecent sessions:\n"));
    all.forEach((s, i) => {
      console.log(`${i + 1}. ${s.title}  ${chalk.gray(new Date(s.updatedAt).toLocaleString())}  ${chalk.dim(s.id)}`);
    });
    console.log(chalk.dim("\nUse /continue <id> to switch to one.\n"));
  },
};

export const continueCommand: Command = {
  name: "/continue",
  description: "Switch to your most recent session, or a specific one by id",
  handler: async (arg, ctx) => {
    const targetId = arg.trim();

    const target = targetId ? getSession(targetId) : listSessions(1)[0];

    if (!target) {
      console.log(
        chalk.red(
          targetId
            ? `\nNo session found with id: ${targetId}\n`
            : "\nNo sessions yet — nothing to continue.\n"
        )
      );
      return;
    }

    const dbMessages = getMessages(target.id);
    const loadedMessages: ModelMessage[] = dbMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    ctx.sessionId = target.id;
    ctx.messages = loadedMessages;
    ctx.isNewChat = false;
    ctx.titleGenerated = true;

    console.log(chalk.green(`\nSwitched to session: ${target.title}\n`));
  },
};

export const newCommand: Command = {
  name: "/new",
  description: "Start a fresh session",
  handler: async (arg, ctx) => {
    const name = arg.trim() || undefined;
    const sessionId = createSession(name);

    ctx.sessionId = sessionId;
    ctx.messages = [];
    ctx.isNewChat = true;
    ctx.titleGenerated = false;

    console.log(chalk.green("\nStarted a new session.\n"));
  },
};