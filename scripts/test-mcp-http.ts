import { GET as mcpGET, POST as mcpPOST } from "../app/api/mcp/route";
import { NextRequest } from "next/server";
import assert from "node:assert";

async function main() {
  console.log("=== Testing /api/mcp HTTP Endpoint ===");

  // 1. GET /api/mcp (discovery and status)
  const getRes = await mcpGET();
  assert.strictEqual(getRes.status, 200);
  const getData = await getRes.json();
  assert.strictEqual(getData.status, "online");
  assert.strictEqual(getData.tools.length, 7);
  console.log("1. GET /api/mcp passed: 7 tools registered, status online");

  // 2. POST /api/mcp with JSON-RPC tools/list
  const listReq = new NextRequest("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    }),
  });
  const listRes = await mcpPOST(listReq);
  assert.strictEqual(listRes.status, 200);
  const listData = await listRes.json();
  assert.strictEqual(listData.result.tools.length, 7);
  console.log("2. JSON-RPC tools/list passed:", listData.result.tools.map((t: { name: string }) => t.name));

  // 3. POST /api/mcp with JSON-RPC tools/call (search_scripture)
  const callReq = new NextRequest("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "search_scripture",
        arguments: { topic_or_keyword: "anxiety" },
      },
    }),
  });
  const callRes = await mcpPOST(callReq);
  assert.strictEqual(callRes.status, 200);
  const callData = await callRes.json();
  assert.strictEqual(callData.result.isError, false);
  console.log("3. JSON-RPC tools/call passed:", callData.result.content[0].text.substring(0, 80) + "...");

  console.log("\n>>> ALL /api/mcp TESTS PASSED SUCCESSFULLY! <<<");
}

main().catch((err) => {
  console.error("MCP HTTP test failed:", err);
  process.exit(1);
});
