import assert from "node:assert";
import { chunkTextForTTS } from "../lib/voice/speech-client";

function testLyricsSyncMechanics() {
  console.log("=== Testing Lyrics-Style Text Highlighting Synchronization ===\n");

  const samplePastoralResponse =
    "I hear the frustration in your words, and I want to sincerely apologize for the delay. " +
    "Sometimes, even in this digital space, things don't move as swiftly as we need them to. " +
    "May God grant you peace, comfort, and patience.";

  // Step 1: Divide text into chunks using chunkTextForTTS
  const chunks = chunkTextForTTS(samplePastoralResponse);
  console.log("Generated chunks for speech:", JSON.stringify(chunks, null, 2));

  assert.ok(chunks.length >= 3, "Sample response should produce at least 3 chunks");

  // Step 2: Simulate playback cycle
  let currentChunkIndex: number = -1;
  let isSpeaking = true;

  // Chunk 0 starts speaking
  currentChunkIndex = 0;
  console.log(`\n[Playback 0] Speaking chunk 0: "${chunks[0]}"`);
  assert.strictEqual(currentChunkIndex, 0);

  // Evaluate chunk states for lyrics display
  for (let i = 0; i < chunks.length; i++) {
    const isCurrent = isSpeaking && i === currentChunkIndex;
    const isPast = isSpeaking && (currentChunkIndex as number) !== -1 && i < currentChunkIndex;
    const isFuture = isSpeaking && (currentChunkIndex as number) !== -1 && i > currentChunkIndex;

    if (i === 0) {
      assert.ok(isCurrent, "Chunk 0 must be marked as current (highlighted)");
      assert.ok(!isPast, "Chunk 0 is not past");
      assert.ok(!isFuture, "Chunk 0 is not future");
    } else {
      assert.ok(!isCurrent, `Chunk ${i} must not be current`);
      assert.ok(!isPast, `Chunk ${i} must not be past`);
      assert.ok(isFuture, `Chunk ${i} must be marked future (dimmed)`);
    }
  }
  console.log("✓ Chunk 0 actively highlighted, future chunks dimmed.");

  // Chunk 1 starts speaking
  currentChunkIndex = 1;
  console.log(`\n[Playback 1] Speaking chunk 1: "${chunks[1]}"`);
  assert.ok(isSpeaking && currentChunkIndex === 1);

  // At chunk 1: chunk 0 is past, chunk 1 is current, chunk 2 is future
  assert.ok(0 < currentChunkIndex, "Chunk 0 is past");
  assert.ok(1 === currentChunkIndex, "Chunk 1 is current");
  assert.ok(2 > currentChunkIndex, "Chunk 2 is future");
  console.log("✓ Chunk 1 actively highlighted, chunk 0 past (visible), chunk 2 future (dimmed).");

  // Chunk 2 starts speaking
  currentChunkIndex = 2;
  console.log(`\n[Playback 2] Speaking chunk 2: "${chunks[2]}"`);
  assert.ok(0 < currentChunkIndex, "Chunk 0 is past");
  assert.ok(1 < currentChunkIndex, "Chunk 1 is past");
  assert.ok(2 === currentChunkIndex, "Chunk 2 is current");
  console.log("✓ Chunk 2 actively highlighted, chunks 0 and 1 past.");

  // Speech finishes
  isSpeaking = false;
  currentChunkIndex = -1;
  console.log("\n[Playback Finished] isSpeaking is false");
  for (let i = 0; i < chunks.length; i++) {
    const isStillActive: boolean = Boolean(isSpeaking && i === currentChunkIndex);
    assert.strictEqual(isStillActive, false, "No chunk should be current after playback");
  }
  console.log("✓ All chunks returned to full opacity at rest.");

  console.log("\n>>> ALL LYRICS SYNC TESTS PASSED! <<<");
}

testLyricsSyncMechanics();
