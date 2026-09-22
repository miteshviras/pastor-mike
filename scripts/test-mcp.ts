import { executeMcpTool, MCP_TOOLS } from "../lib/mcp/tools";
import { createSession, getOrCreateDefaultUser } from "../lib/db";
import assert from "node:assert";

async function main() {
  console.log("=== Testing MCP Tool Layer ===");
  console.log(`Available MCP tools count: ${MCP_TOOLS.length}`);
  assert.strictEqual(MCP_TOOLS.length, 7, "Should have 7 MCP tools defined");

  const user = getOrCreateDefaultUser();
  const session = createSession(user.id);

  // 1. Tool: search_scripture
  const res1 = await executeMcpTool("search_scripture", { topic_or_keyword: "work anxiety" });
  assert.strictEqual(res1.success, true);
  const searchData = res1.data as { query: string; count: number; verses: Array<{ reference: string }> };
  assert.ok(searchData.count > 0);
  console.log("1. search_scripture tool passed:", searchData.verses[0].reference);

  // 2. Tool: get_verse
  const res2 = await executeMcpTool("get_verse", { reference: "Philippians 4:6-7" });
  assert.strictEqual(res2.success, true);
  const verseData = res2.data as { reference: string; text: string };
  assert.strictEqual(verseData.reference, "Philippians 4:6-7");
  console.log("2. get_verse tool passed:", verseData.reference);

  // 3. Tool: save_prayer_request
  const res3 = await executeMcpTool("save_prayer_request", {
    text: "Pray for healing for my grandmother.",
    session_id: session.id,
  }, { userId: user.id });
  assert.strictEqual(res3.success, true);
  const prayerData = res3.data as { id: string; request_text: string };
  console.log("3. save_prayer_request tool passed:", prayerData.id, prayerData.request_text);

  // 4. Tool: save_memory
  const res4 = await executeMcpTool("save_memory", {
    key: "mentor_name",
    value: "Pastor David",
  }, { userId: user.id });
  assert.strictEqual(res4.success, true);
  console.log("4. save_memory tool passed");

  // 5. Tool: load_memory
  const res5 = await executeMcpTool("load_memory", {
    key: "mentor_name",
  }, { userId: user.id });
  assert.strictEqual(res5.success, true);
  const memData = res5.data as { value: string };
  assert.strictEqual(memData.value, "Pastor David");
  console.log("5. load_memory tool passed:", memData.value);

  // 6. Tool: summarize_session
  const res6 = await executeMcpTool("summarize_session", {
    session_id: session.id,
    summary: "Believer requested prayer for grandmother and scripture on peace.",
  });
  assert.strictEqual(res6.success, true);
  console.log("6. summarize_session tool passed");

  // 7. Tool: get_recent_context
  const res7 = await executeMcpTool("get_recent_context", {}, { userId: user.id });
  assert.strictEqual(res7.success, true);
  const ctxData = res7.data as { recentSummaries: string[]; memories: Record<string, string> };
  assert.ok(ctxData.recentSummaries.length > 0);
  assert.strictEqual(ctxData.memories["mentor_name"], "Pastor David");
  console.log("7. get_recent_context tool passed, summaries:", ctxData.recentSummaries.length);

  // 8. Graceful failure on unknown tool
  const res8 = await executeMcpTool("unknown_tool", {});
  assert.strictEqual(res8.success, false);
  console.log("8. Unknown tool graceful error handled:", res8.error);

  console.log("\n>>> ALL MCP TOOL TESTS PASSED SUCCESSFULLY! <<<");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
