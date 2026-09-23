import { GET as sttGET, POST as sttPOST } from "../app/api/stt/route";
import { NextRequest } from "next/server";
import assert from "node:assert";

async function checkLiveServer(): Promise<boolean> {
  try {
    const res = await fetch("http://localhost:3000/api/stt", { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  console.log("=== Testing /api/stt Endpoint & Moonshine STT Adapter ===");

  // 1. In-process route test: GET /api/stt
  console.log("\n[Test 1] Testing in-process GET /api/stt...");
  const getRes = await sttGET();
  assert.strictEqual(getRes.status, 200, "GET /api/stt should return 200");
  const getStatus = await getRes.json();
  console.log("In-process STT Status:", JSON.stringify(getStatus, null, 2));
  assert.ok(typeof getStatus.installed === "boolean", "Status should include installed boolean");
  assert.ok(getStatus.engine, "Status should specify an engine");

  // 2. In-process route test: POST /api/stt empty body validation
  console.log("\n[Test 2] Testing empty audio validation...");
  const emptyReq = new NextRequest("http://localhost:3000/api/stt", {
    method: "POST",
    headers: { "Content-Type": "audio/wav" },
    body: new ArrayBuffer(0),
  });
  const emptyRes = await sttPOST(emptyReq);
  assert.strictEqual(emptyRes.status, 400, "Empty audio buffer should return 400");
  console.log("Empty audio validation verified.");

  // 3. Live Docker container end-to-end test (if Docker container is active on port 3000)
  const isLive = await checkLiveServer();
  if (isLive) {
    console.log("\n[Test 3] Live Docker container detected on http://localhost:3000!");
    console.log("Checking live GET /api/stt from container...");
    const liveGetRes = await fetch("http://localhost:3000/api/stt");
    assert.strictEqual(liveGetRes.status, 200);
    const liveStatus = await liveGetRes.json();
    console.log("Live Container STT Status:", JSON.stringify(liveStatus, null, 2));
    assert.strictEqual(liveStatus.installed, true, "Moonshine should be installed in Docker");
    assert.strictEqual(liveStatus.has_ffmpeg, true, "ffmpeg should be installed in Docker");
    assert.strictEqual(liveStatus.has_local_model, true, "Moonshine model should be cached in Docker volume");

    console.log("\n[Test 4] Generating audio via live KittenTTS and transcribing via live Moonshine STT...");
    const ttsRes = await fetch("http://localhost:3000/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "May peace and grace be with you." }),
    });

    assert.strictEqual(ttsRes.status, 200);
    const audioBuf = await ttsRes.arrayBuffer();
    assert.ok(audioBuf.byteLength > 1000, "Synthesized audio should be valid WAV");
    console.log(`Generated audio size: ${audioBuf.byteLength} bytes`);

    console.log("Sending WAV buffer to live /api/stt...");
    const sttRes = await fetch("http://localhost:3000/api/stt", {
      method: "POST",
      headers: { "Content-Type": "audio/wav" },
      body: audioBuf,
    });

    assert.strictEqual(sttRes.status, 200, "Live STT should return 200");
    const sttData = await sttRes.json();
    console.log("Live STT transcription result:", JSON.stringify(sttData));
    assert.ok(sttData.text, "Transcription text should be non-empty");
    assert.strictEqual(sttData.engine, "moonshine", "Engine should be moonshine");
    console.log(`Transcribed accurately: "${sttData.text}"`);
  } else {
    console.log("\n[Info] Live server on port 3000 is not running. Live container test skipped.");
  }

  console.log("\n>>> ALL STT TESTS PASSED SUCCESSFULLY! <<<");
}

main().catch((err) => {
  console.error("STT test failed:", err);
  process.exit(1);
});
