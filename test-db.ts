import { createSession, addMessage, completeMessage, getMessages, listSessions } from "./db/queries";

console.log("--- Creating a session ---");
const sessionId = createSession("Test session");
console.log("Session created:", sessionId);

console.log("\n--- Adding a user message ---");
const userMsgId = addMessage(sessionId, "user", "Hello, this is a test");
console.log("User message added:", userMsgId);

console.log("\n--- Adding an assistant message (pending) ---");
const assistantMsgId = addMessage(sessionId, "assistant", "Hi! This is a test reply");
console.log("Assistant message added (should be pending):", assistantMsgId);

console.log("\n--- Completing the assistant message ---");
completeMessage(assistantMsgId, 12, 8, 0.0002);
console.log("Marked as complete with token/cost data");

console.log("\n--- Fetching all messages in this session ---");
const msgs = getMessages(sessionId);
console.log(msgs);

console.log("\n--- Listing all sessions ---");
const allSessions = listSessions();
console.log(allSessions);