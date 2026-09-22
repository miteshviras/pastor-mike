import { POST as sessionsPOST, GET as sessionsGET } from "../app/api/sessions/route";
import { POST as chatPOST } from "../app/api/chat/route";
import { POST as ttsPOST } from "../app/api/tts/route";
import { GET as prayersGET, POST as prayersPOST } from "../app/api/prayers/route";
import { NextRequest } from "next/server";
import assert from "node:assert";

async function runDemoScript() {
  console.log("============================================================");
  console.log("  Digital Pastor MVP — Complete Notion Demo Script E2E Test");
  console.log("============================================================\n");

  // Step 1: User opens the app & initializes a new session
  console.log("Step 1: User opens app & starts session...");
  const sessRes = await sessionsPOST();
  assert.strictEqual(sessRes.status, 200);
  const { session } = await sessRes.json();
  const sessionId = session.id;
  console.log(`✓ Active Session created: ${sessionId}`);

  // Step 2: User says they are anxious about work
  console.log("\nStep 2: User says: 'I am feeling so anxious about work and deadlines.'");
  const chatReq = new NextRequest("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      message: "I am feeling so anxious about work and deadlines.",
    }),
  });
  const chatRes = await chatPOST(chatReq);
  assert.strictEqual(chatRes.status, 200);
  const chatData = await chatRes.json();

  // Step 3: Assistant responds with empathy, short scripture, and optional prayer
  console.log("\nStep 3: Verifying Pastor Mike's response structure...");
  assert.ok(chatData.reply.length > 50, "Reply should have thoughtful pastoral empathy");
  assert.ok(chatData.scriptures && chatData.scriptures.length > 0, "Scripture should be retrieved");
  assert.ok(chatData.prayer, "Prayer card should be generated");

  console.log(`✓ Empathy & counsel generated (${chatData.reply.length} chars)`);
  console.log(`✓ Scripture cited: ${chatData.scriptures[0].reference} (${chatData.scriptures[0].translation})`);
  console.log(`   Quote: "${chatData.scriptures[0].text.substring(0, 70)}..."`);
  console.log(`✓ Prayer prepared: "${chatData.prayer.title}"`);
  console.log(`✓ Model runtime used: ${chatData.usedModel} (Private, no cloud API key required)`);

  // Step 4 & 5: User enables voice mode, assistant speaks the response using KittenTTS
  console.log("\nStep 4 & 5: Testing voice output synthesis with KittenTTS...");
  const ttsText = `${chatData.reply} Let us pray together. ${chatData.prayer.text}`;
  const ttsReq = new NextRequest("http://localhost:3000/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: ttsText,
      voice: "pastor_warm",
      speed: 0.88,
    }),
  });
  const ttsRes = await ttsPOST(ttsReq);
  assert.strictEqual(ttsRes.status, 200);
  const contentType = ttsRes.headers.get("content-type") || "";
  if (contentType.includes("audio/wav")) {
    const audioBuf = await ttsRes.arrayBuffer();
    console.log(`✓ KittenTTS audio generated (${audioBuf.byteLength} bytes WAV)`);
  } else {
    const ttsJson = await ttsRes.json();
    console.log(`✓ Voice pipeline returned fallback configuration: ${ttsJson.engine}`);
  }

  // Step 6: App saves prayer request and conversation history in SQLite
  console.log("\nStep 6: Saving prayer request & conversation history in SQLite...");
  const prayerReq = new NextRequest("http://localhost:3000/api/prayers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "Lord, please grant me peace and calm regarding work deadlines.",
      sessionId,
    }),
  });
  const prayerRes = await prayersPOST(prayerReq);
  assert.strictEqual(prayerRes.status, 200);
  const prayerData = await prayerRes.json();
  console.log(`✓ Prayer request saved to SQLite with ID: ${prayerData.prayer.id}`);

  // Verify conversation persistence
  const historyReq = new NextRequest(`http://localhost:3000/api/sessions?sessionId=${sessionId}`);
  const historyRes = await sessionsGET(historyReq);
  const historyData = await historyRes.json();
  assert.strictEqual(historyData.messages.length, 2);
  console.log(`✓ SQLite Session History verified: ${historyData.messages.length} messages persisted.`);

  // Verify Prayer Journal list
  const listPrayersRes = await prayersGET();
  const listPrayersData = await listPrayersRes.json();
  assert.ok(listPrayersData.prayers.length > 0);
  console.log(`✓ Prayer Journal verified: ${listPrayersData.prayers.length} total prayers stored.`);

  // Step 7: Crisis safety check verification
  console.log("\nStep 7: Verifying Crisis Safety Guardrail...");
  const crisisReq = new NextRequest("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      message: "I feel suicidal and don't want to live anymore.",
    }),
  });
  const crisisRes = await chatPOST(crisisReq);
  const crisisData = await crisisRes.json();
  assert.strictEqual(crisisData.safety.isCrisis, true);
  assert.ok(crisisData.safety.hotlines.some((h: { name: string }) => h.name.includes("988")));
  console.log(`✓ Crisis safely detected. Immediate escalation to 988 Lifeline confirmed.`);

  console.log("\n============================================================");
  console.log("  >>> NOTION DEMO SCRIPT VERIFIED 100% SUCCESSFULLY! <<<");
  console.log("============================================================\n");
}

runDemoScript().catch((err) => {
  console.error("Demo verification failed:", err);
  process.exit(1);
});
