import { POST as ttsPOST } from "../app/api/tts/route";
import { NextRequest } from "next/server";
import assert from "node:assert";

async function main() {
  console.log("=== Testing /api/tts Endpoint & KittenTTS Adapter ===");

  const req = new NextRequest("http://localhost:3000/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "The Lord is my shepherd; I shall not want.",
      voice: "pastor_warm",
      speed: 0.88,
    }),
  });

  const res = await ttsPOST(req);
  assert.strictEqual(res.status, 200, "TTS response status should be 200");

  const contentType = res.headers.get("content-type") || "";
  console.log("TTS Content-Type:", contentType);

  if (contentType.includes("audio/wav")) {
    const arrayBuffer = await res.arrayBuffer();
    assert.ok(arrayBuffer.byteLength > 100, "Audio WAV buffer should be non-empty");
    console.log(`KittenTTS audio generated successfully! Size: ${arrayBuffer.byteLength} bytes`);
  } else {
    const data = await res.json();
    assert.strictEqual(data.fallback, true);
    console.log("Browser fallback instructions returned:", data);
  }

  console.log("\n>>> ALL TTS TESTS PASSED SUCCESSFULLY! <<<");
}

main().catch((err) => {
  console.error("TTS test failed:", err);
  process.exit(1);
});
