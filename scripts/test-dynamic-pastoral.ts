import { processPastoralTurn } from "../lib/ai/orchestrator";
import { createSession, getOrCreateDefaultUser } from "../lib/db";
import assert from "node:assert";

async function testDynamicPastoralCare() {
  console.log("============================================================");
  console.log("  Testing Dynamic Pastoral Content & Connected MCP Detection");
  console.log("============================================================\n");

  const user = getOrCreateDefaultUser();
  const session = createSession(user.id);

  // Test Case 1: Grief & Loss
  console.log("--- Test Case 1: Grief & Loss ---");
  const griefTurn = await processPastoralTurn(
    session.id,
    "My grandmother passed away yesterday and I cannot stop crying.",
    { userId: user.id }
  );
  console.log(`Reply snippet:\n"${griefTurn.reply.substring(0, 180)}..."`);
  console.log(`Prayer title: "${griefTurn.prayer?.title}"`);
  console.log(`MCP Client: ${griefTurn.mcp?.clientName} (tools: ${griefTurn.mcp?.toolsCalled.join(", ")})`);

  assert.ok(griefTurn.reply.toLowerCase().includes("sacred") || griefTurn.reply.toLowerCase().includes("grief") || griefTurn.reply.toLowerCase().includes("loss"));
  assert.ok(griefTurn.prayer?.title.includes("Sorrow") || griefTurn.prayer?.title.includes("Grief"));
  assert.strictEqual(griefTurn.mcp?.isConnected, true);
  console.log("✓ Grief test passed!\n");

  // Test Case 2: Health & Surgery
  console.log("--- Test Case 2: Health & Medical Anxiety ---");
  const healthTurn = await processPastoralTurn(
    session.id,
    "I have a scary surgery scheduled at the hospital tomorrow morning.",
    { userId: user.id }
  );
  console.log(`Reply snippet:\n"${healthTurn.reply.substring(0, 180)}..."`);
  console.log(`Prayer title: "${healthTurn.prayer?.title}"`);
  assert.ok(healthTurn.reply.toLowerCase().includes("health") || healthTurn.reply.toLowerCase().includes("vulnerability") || healthTurn.reply.toLowerCase().includes("breath"));
  assert.strictEqual(healthTurn.mcp?.isConnected, true);
  console.log("✓ Health & surgery test passed!\n");

  // Test Case 3: Explicit Prayer Request
  console.log("--- Test Case 3: Explicit Prayer Request with Persistence ---");
  const prayerTurn = await processPastoralTurn(
    session.id,
    "Please pray for my daughter who is struggling with college exams.",
    { userId: user.id }
  );
  console.log(`Reply snippet:\n"${prayerTurn.reply.substring(0, 180)}..."`);
  console.log(`Saved Prayer ID: ${prayerTurn.savedPrayerId}`);
  console.log(`Tools Called: ${prayerTurn.mcp?.toolsCalled.join(", ")}`);
  assert.ok(prayerTurn.savedPrayerId, "Should save prayer request to SQLite");
  assert.ok(prayerTurn.mcp?.toolsCalled.includes("save_prayer_request"));
  console.log("✓ Prayer save & MCP tracking passed!\n");

  console.log("============================================================");
  console.log("  >>> ALL DYNAMIC PASTORAL TESTS PASSED SUCCESSFULLY! <<<");
  console.log("============================================================");
}

testDynamicPastoralCare().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
