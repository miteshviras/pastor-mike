import {
  getOrCreateDefaultUser,
  createSession,
  saveMessage,
  getSessionMessages,
  savePrayerRequest,
  listPrayerRequests,
  updatePrayerStatus,
  saveMemory,
  loadMemory,
  saveConversationSummary,
  getRecentContext,
} from "../lib/db";
import assert from "node:assert";

console.log("=== Testing SQLite Database Layer ===");

// 1. User
const user = getOrCreateDefaultUser();
console.log("1. User initialized:", user.id, user.display_name);
assert.strictEqual(user.id, "user_default");

// 2. Session
const session = createSession(user.id);
console.log("2. Session created:", session.id);
assert.ok(session.id.startsWith("sess_"));

// 3. Messages
const userMsg = saveMessage(session.id, "user", "I need guidance today with anxiety.");
const botMsg = saveMessage(session.id, "assistant", "Peace be with you. Cast all your cares upon Him.", {
  scripture: "1 Peter 5:7",
});
console.log("3. Messages saved:", userMsg.id, botMsg.id);

const messages = getSessionMessages(session.id);
assert.strictEqual(messages.length, 2);
assert.strictEqual(messages[0].content, "I need guidance today with anxiety.");
console.log("   Messages fetched successfully, count:", messages.length);

// 4. Prayer Requests
const prayer = savePrayerRequest(user.id, "Please pray for strength and peace in my new job.", session.id);
console.log("4. Prayer request saved:", prayer.id, prayer.status);
assert.strictEqual(prayer.status, "active");

let prayers = listPrayerRequests(user.id);
assert.ok(prayers.some(p => p.id === prayer.id));

updatePrayerStatus(prayer.id, "answered");
prayers = listPrayerRequests(user.id);
const updatedPrayer = prayers.find(p => p.id === prayer.id);
assert.strictEqual(updatedPrayer?.status, "answered");
console.log("   Prayer status successfully updated to:", updatedPrayer?.status);

// 5. Memory
saveMemory(user.id, "preferred_topic", "anxiety and peace");
const memValue = loadMemory(user.id, "preferred_topic");
assert.strictEqual(memValue, "anxiety and peace");
console.log("5. Memory saved and loaded:", memValue);

// 6. Summary & Context
saveConversationSummary(session.id, "User discussed work anxiety; provided encouragement and 1 Peter 5:7.");
const context = getRecentContext(user.id);
console.log("6. Recent context fetched:", context);
assert.ok(context.recentSummaries.length > 0);
assert.strictEqual(context.memories["preferred_topic"], "anxiety and peace");

console.log("\n>>> ALL SQLite TESTS PASSED SUCCESSFULLY! <<<");
