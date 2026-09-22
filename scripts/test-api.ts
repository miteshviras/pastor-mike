import { POST as chatPOST } from "../app/api/chat/route";
import { GET as sessionsGET, POST as sessionsPOST } from "../app/api/sessions/route";
import { GET as prayersGET, POST as prayersPOST, PATCH as prayersPATCH } from "../app/api/prayers/route";
import { NextRequest } from "next/server";
import assert from "node:assert";

async function main() {
  console.log("=== Testing App Router API Route Handlers ===");

  // 1. POST /api/sessions
  console.log("\n1. Testing POST /api/sessions...");
  const sessRes = await sessionsPOST();
  assert.strictEqual(sessRes.status, 200);
  const sessData = await sessRes.json();
  assert.ok(sessData.session?.id);
  const sessionId = sessData.session.id;
  console.log("   Created session:", sessionId);

  // 2. POST /api/chat
  console.log("\n2. Testing POST /api/chat...");
  const chatReq = new NextRequest("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      message: "Pastor Mike, work has been so stressful and I feel anxious.",
    }),
  });
  const chatRes = await chatPOST(chatReq);
  assert.strictEqual(chatRes.status, 200);
  const chatData = await chatRes.json();
  assert.strictEqual(chatData.sessionId, sessionId);
  assert.ok(chatData.reply.length > 0);
  assert.ok(chatData.scriptures.length > 0);
  assert.ok(chatData.prayer);
  console.log("   Chat response received for session:", chatData.sessionId);
  console.log("   Scripture cited:", chatData.scriptures[0].reference);

  // 3. GET /api/sessions?sessionId=...
  console.log("\n3. Testing GET /api/sessions with sessionId query...");
  const getSessReq = new NextRequest(`http://localhost:3000/api/sessions?sessionId=${sessionId}`);
  const getSessRes = await sessionsGET(getSessReq);
  assert.strictEqual(getSessRes.status, 200);
  const getSessData = await getSessRes.json();
  assert.strictEqual(getSessData.messages.length, 2);
  console.log("   Retrieved messages count:", getSessData.messages.length);

  // 4. POST /api/prayers
  console.log("\n4. Testing POST /api/prayers...");
  const prayReq = new NextRequest("http://localhost:3000/api/prayers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "Pray for wisdom in leading my team.",
      sessionId,
    }),
  });
  const prayRes = await prayersPOST(prayReq);
  assert.strictEqual(prayRes.status, 200);
  const prayData = await prayRes.json();
  assert.ok(prayData.prayer?.id);
  const prayerId = prayData.prayer.id;
  console.log("   Saved prayer ID:", prayerId);

  // 5. PATCH /api/prayers
  console.log("\n5. Testing PATCH /api/prayers...");
  const patchReq = new NextRequest("http://localhost:3000/api/prayers", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: prayerId,
      status: "answered",
    }),
  });
  const patchRes = await prayersPATCH(patchReq);
  assert.strictEqual(patchRes.status, 200);
  const patchData = await patchRes.json();
  assert.strictEqual(patchData.status, "answered");
  console.log("   Prayer status updated to answered.");

  // 6. GET /api/prayers
  console.log("\n6. Testing GET /api/prayers...");
  const listPrayRes = await prayersGET();
  assert.strictEqual(listPrayRes.status, 200);
  const listPrayData = await listPrayRes.json();
  assert.ok(listPrayData.prayers.length > 0);
  console.log("   Total prayers in journal:", listPrayData.prayers.length);

  console.log("\n>>> ALL API ROUTE TESTS PASSED SUCCESSFULLY! <<<");
}

main().catch((err) => {
  console.error("API test failed:", err);
  process.exit(1);
});
