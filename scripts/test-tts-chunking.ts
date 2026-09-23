import assert from "node:assert";
import { chunkTextForTTS } from "../lib/voice/speech-client";

function runTtsChunkingTests() {
  console.log("=== Testing Punctuation-Aware TTS Chunking (Fullstop / Comma / 10-15 Words Fallback) ===\n");

  // Test 1: Fullstop boundary breaks
  console.log("[Test 1] Testing full stop priority over naive word counts...");
  const textWithPeriods = "Peace be with you, my friend. The Lord will guide your steps through every valley and mountain. Trust in Him.";
  const chunks1 = chunkTextForTTS(textWithPeriods);
  console.log("Input:", textWithPeriods);
  console.log("Chunks generated:", JSON.stringify(chunks1, null, 2));

  assert.strictEqual(chunks1.length, 3, "Should produce 3 distinct chunks corresponding to sentences");
  assert.strictEqual(chunks1[0], "Peace be with you, my friend.");
  assert.strictEqual(chunks1[1], "The Lord will guide your steps through every valley and mountain.");
  assert.strictEqual(chunks1[2], "Trust in Him.");
  console.log("✓ Fullstop boundaries verified.\n");

  // Test 2: Comma clause breaks in long compound sentence
  console.log("[Test 2] Testing comma clause breaks in a compound sentence...");
  const textWithCommas = "In times of sorrow and deep grief, when everything feels heavy and dark, remember that God has promised never to leave you or forsake you.";
  const chunks2 = chunkTextForTTS(textWithCommas);
  console.log("Input:", textWithCommas);
  console.log("Chunks generated:", JSON.stringify(chunks2, null, 2));

  assert.ok(chunks2.length >= 2, "Should break into clauses");
  assert.ok(chunks2[0].endsWith(","), `Chunk 0 should end on a comma: "${chunks2[0]}"`);
  assert.ok(chunks2[chunks2.length - 1].endsWith("."), `Final chunk should end on period: "${chunks2[chunks2.length - 1]}"`);
  for (const c of chunks2) {
    const wordCount = c.split(/\s+/).length;
    assert.ok(wordCount <= 15, `Chunk must not exceed 15 words: got ${wordCount} in "${c}"`);
  }
  console.log("✓ Comma clause breaks verified.\n");

  // Test 3: Fallback when NO fullstop or comma is present for 20+ words
  console.log("[Test 3] Testing fallback when no fullstop or comma is present for 25 words...");
  const textWithoutPunctuation = "We must always remember that God our loving father is watching over each and every step of our life through every single season without failing";
  const chunks3 = chunkTextForTTS(textWithoutPunctuation);
  console.log("Input:", textWithoutPunctuation);
  console.log("Chunks generated:", JSON.stringify(chunks3, null, 2));

  assert.ok(chunks3.length >= 2, "Should chunk into multiple segments");
  for (const c of chunks3) {
    const count = c.split(/\s+/).length;
    assert.ok(count >= 1 && count <= 15, `Fallback chunk must be in 10-15 word range (or remainder): got ${count} words in "${c}"`);
  }
  console.log("✓ Fallback 10-15 word queuing verified.\n");

  // Test 4: Short text (< 15 words)
  console.log("[Test 4] Testing short text (< 15 words)...");
  const shortText = "The Lord is with you.";
  const chunks4 = chunkTextForTTS(shortText);
  assert.strictEqual(chunks4.length, 1);
  assert.strictEqual(chunks4[0], shortText);
  console.log("✓ Short text single-chunk preserved.\n");

  // Test 5: Empty text
  console.log("[Test 5] Testing empty input...");
  const emptyChunks = chunkTextForTTS("   ");
  assert.strictEqual(emptyChunks.length, 0);
  console.log("✓ Empty input returns empty array.\n");

  // Test 6: Real pastoral response
  console.log("[Test 6] Testing real pastoral response chunking...");
  const pastoralResponse = "Come to me, all you who are weary and burdened, and I will give you rest. Take my yoke upon you and learn from me, for I am gentle and humble in heart. You will find rest for your souls.";
  const chunks6 = chunkTextForTTS(pastoralResponse);
  console.log("Chunks for pastoral response:", JSON.stringify(chunks6, null, 2));
  for (const c of chunks6) {
    const count = c.split(/\s+/).length;
    assert.ok(count <= 15, `Each chunk should be <= 15 words: got ${count}`);
    assert.ok(
      c.endsWith(".") || c.endsWith(",") || c.endsWith("!") || c.endsWith("?"),
      `Chunk should cleanly terminate at punctuation: "${c}"`
    );
  }
  console.log("✓ Real pastoral response cleanly segmented at punctuation.\n");

  console.log(">>> ALL TTS CHUNKING TESTS PASSED SUCCESSFULLY! <<<");
}

runTtsChunkingTests();
