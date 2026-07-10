// import { streamText, type ModelMessage } from "ai";
// import { model } from "./provider";
// import chalk from "chalk";
// import { readFileSync, writeFileSync, existsSync } from "fs";

// const HISTORY_FILE = "./chat-history.json";
// // Terse
// const SYSTEM_PROMPT = "You are a helpful, concise terminal assistant. Answer in 1-2 sentences max.";

// // Persona
// //const SYSTEM_PROMPT = "You are a grumpy senior engineer reviewing code. Be blunt and sarcastic but still correct.";

// // Structured
// //const SYSTEM_PROMPT = "You are a technical assistant. Always answer in this format: Answer, then Why, then Example.";



// function loadHistory(): ModelMessage[] {
//   if (existsSync(HISTORY_FILE)) {
//     return JSON.parse(readFileSync(HISTORY_FILE, "utf-8"));
//   }
//   return [];
// }

// function saveHistory(messages: ModelMessage[]) {
//   writeFileSync(HISTORY_FILE, JSON.stringify(messages, null, 2));
// }


// async function main() {
//   const messages = loadHistory();          
//   const isNewChat = messages.length === 0;

//   console.log(chalk.cyan.bold("\n🤖 Terminal Chat — type 'exit' to quit, 'reset' to clear memory\n"));

//   if (isNewChat) {
//     console.log(chalk.magenta.bold("AI: ") + "Salam alaykom! Fach najm n3awnek lyom?\n");
//   }

//   while (true) {
//     const userInput = prompt(chalk.green.bold("You: "));
//     if (!userInput || userInput.trim().toLowerCase() === "exit") {
//       console.log(chalk.yellow("\nGoodbye 👋\n"));
//       break;
//     }
//     if (userInput.trim().toLowerCase() === "reset") {
//       messages.length = 0;
//       saveHistory(messages);               
//       console.log(chalk.yellow("Memory cleared.\n"));
//       continue;
//     }

//     messages.push({ role: "user", content: userInput });
//     process.stdout.write(chalk.magenta.bold("AI: "));

//     const result = streamText({
//       model,
//       instructions: SYSTEM_PROMPT,
//       messages,
//     });

//     let fullResponse = "";
//     for await (const chunk of result.textStream) {
//       process.stdout.write(chunk);
//       fullResponse += chunk;
//     }
//     console.log("\n");

//     messages.push({ role: "assistant", content: fullResponse });
//     saveHistory(messages);                 
//   }
// }

// main();

import { streamText, type ModelMessage } from "ai";
import { model } from "./provider";
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

const SYSTEM_PROMPT = "You are a helpful, concise terminal assistant.";

async function main() {
  // Startup recovery — must run before anything else
  markOrphanedInterrupted();

  const args = process.argv.slice(2);
  let sessionId: string;
  let isNewChat = false;

  if (args[0] === "continue") {
    const recent = listSessions(1);
    if (recent.length === 0) {
      sessionId = createSession();
      isNewChat = true;
    } else {
      sessionId = recent[0].id;
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

  console.log(chalk.cyan.bold("\n🤖 Terminal Chat — type 'exit' to quit\n"));

  if (isNewChat) {
    console.log(chalk.magenta.bold("AI: ") + "Salam alaykom! How can I assist you today?\n");
  }

  // Rebuild in-memory message history from DB for this session
  const dbMessages = getMessages(sessionId);
  const messages: ModelMessage[] = dbMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  while (true) {
    const userInput = prompt(chalk.green.bold("You: "));
    if (!userInput || userInput.trim().toLowerCase() === "exit") {
      console.log(chalk.yellow("\nGoodbye 👋\n"));
      break;
    }

    addMessage(sessionId, "user", userInput);
    messages.push({ role: "user", content: userInput });

    process.stdout.write(chalk.magenta.bold("AI: "));

    const assistantMsgId = addMessage(sessionId, "assistant", ""); // insert as pending

    const result = streamText({
      model,
      instructions: SYSTEM_PROMPT,
      messages,
    });

    let fullResponse = "";
    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
      fullResponse += chunk;
    }
    console.log("\n");

    const usage = await result.usage;
    completeMessage(assistantMsgId, usage?.promptTokens, usage?.completionTokens);

    messages.push({ role: "assistant", content: fullResponse });
  }
}

main();