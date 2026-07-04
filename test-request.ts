import { generateText } from "ai";
import { model } from "./provider";

const result = await generateText({
  model,
  prompt: "say zaineb azyen tofla fi denya just this",
});

console.log(result.text);