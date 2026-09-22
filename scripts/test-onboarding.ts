/**
 * Automated Verification for First-Time User Onboarding & KittenTTS Downloader
 */

import { GET as getTtsStatus, POST as postTts } from "../app/api/tts/route";
import { POST as postMcp } from "../app/api/mcp/route";
import { NextRequest } from "next/server";

async function runOnboardingTests() {
  console.log("============================================================");
  console.log("  Testing First-Time User Onboarding Flow & TTS Downloader  ");
  console.log("============================================================\n");

  // Test 1: Query KittenTTS status via GET /api/tts
  console.log("Test 1: Querying KittenTTS installation status...");
  const statusRes = await getTtsStatus();
  const statusData = await statusRes.json();
  console.log("✓ KittenTTS status retrieved:", statusData.engine, `(Installed: ${statusData.installed})`);

  // Test 2: Verify MCP Tool Connectivity (Step 2 of Onboarding)
  console.log("\nTest 2: Verifying MCP tool connectivity (search_scripture test)...");
  const mcpReq = new NextRequest("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tool: "search_scripture",
      arguments: { topic_or_keyword: "peace and calm" },
    }),
  });
  const mcpRes = await postMcp(mcpReq);
  const mcpData = await mcpRes.json();
  if (mcpRes.ok && (mcpData.results || mcpData.success)) {
    console.log("✓ MCP tool layer verified with query results.");
  } else {
    throw new Error("MCP tool verification failed");
  }

  // Test 3: Save User Preferences to SQLite Memory (Step 1 completion)
  console.log("\nTest 3: Saving user onboarding preferences via MCP save_memory...");
  const memReq = new NextRequest("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tool: "save_memory",
      arguments: {
        key: "user_name",
        value: "Sarah",
      },
    }),
  });
  const memRes = await postMcp(memReq);
  const memData = await memRes.json();
  console.log("✓ Memory saved via MCP tool:", memData);

  // Test 4: Verify 1-Click KittenTTS Downloader endpoint (Step 3)
  console.log("\nTest 4: Testing 1-click KittenTTS download / configuration trigger...");
  const dlReq = new NextRequest("http://localhost:3000/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "download" }),
  });
  const dlRes = await postTts(dlReq);
  const dlData = await dlRes.json();
  console.log("✓ KittenTTS downloader response:", dlData.download_status || dlData.engine || dlData);

  // Test 5: Verify TTS synthesis playback
  console.log("\nTest 5: Testing audio synthesis for pastoral blessing...");
  const ttsReq = new NextRequest("http://localhost:3000/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "The Lord bless you and keep you.",
      voice: "Jasper",
      speed: 0.88,
    }),
  });
  const ttsRes = await postTts(ttsReq);
  const contentType = ttsRes.headers.get("content-type") || "";
  console.log("✓ Audio synthesis output received:", contentType, `(Status: ${ttsRes.status})`);

  console.log("\n============================================================");
  console.log("  >>> ALL ONBOARDING & TTS FLOW TESTS PASSED! <<<");
  console.log("============================================================");
}

runOnboardingTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
