import type { ModelMessage } from "ai";

export interface CommandContext {
  sessionId: string;
  messages: ModelMessage[];
  currentModelId: string;
  isNewChat: boolean;
  titleGenerated: boolean;
}

export interface Command {
  name: string;
  description: string;
  handler: (arg: string, ctx: CommandContext) => Promise<"exit" | void>;
}