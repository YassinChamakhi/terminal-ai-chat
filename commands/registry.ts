import { exitCommand } from "./exit";
import { modelCommand } from "./model";
import { helpCommand } from "./help";
import { sessionsCommand, continueCommand, newCommand } from "./sessions";

export const commandRegistry = [helpCommand, exitCommand, modelCommand, sessionsCommand, continueCommand, newCommand];