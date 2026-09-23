import assert from "node:assert";
import { PastoralSpeechClient, chunkTextForTTS } from "../lib/voice/speech-client";

// Mock HTMLAudioElement for Node test environment
class MockAudioElement {
  public currentTime = 0;
  public paused = true;
  public src = "blob:http://localhost:3000/mock-audio";
  public onended: (() => void) | null = null;
  public onerror: (() => void) | null = null;

  public async play(): Promise<void> {
    this.paused = false;
  }

  public pause(): void {
    this.paused = true;
  }
}

// Set up mock window and Audio globals
(global as unknown as { window: unknown }).window = {
  speechSynthesis: {
    speak: () => {},
    pause: () => {},
    resume: () => {},
    cancel: () => {},
    getVoices: () => [],
    speaking: false,
    paused: false,
  },
};
(global as unknown as { Audio: unknown }).Audio = MockAudioElement;
(global as unknown as { URL: unknown }).URL = {
  createObjectURL: () => "blob:http://localhost:3000/mock",
  revokeObjectURL: () => {},
};

async function testPlayPauseAndResume() {
  console.log("=== Testing Play/Pause Speech Controls & Resume-From-Where-It-Left ===\n");

  const sampleText =
    "I hear the frustration in your words, and I want to apologize. " +
    "May God grant you peace, comfort, and steady patience. " +
    "Let us walk through this together with grace.";

  const chunks = chunkTextForTTS(sampleText);
  console.log(`Split sample text into ${chunks.length} chunks:`, chunks);
  assert.ok(chunks.length >= 3, "Sample text should yield at least 3 chunks");

  let speakingStateUpdates: Array<{ isSpeaking: boolean; isPaused?: boolean }> = [];
  let chunkHistory: Array<{ chunkIndex: number; text: string }> = [];

  const client = new PastoralSpeechClient({
    onSpeakingStateChange: (isSpeaking, isPaused) => {
      speakingStateUpdates.push({ isSpeaking, isPaused });
    },
    onSpeakingChunkChange: (chunkIndex, totalChunks, chunkText) => {
      chunkHistory.push({ chunkIndex, text: chunkText });
    },
  });

  // Mock fetchChunkAudio to return our MockAudioElement
  (client as unknown as { fetchChunkAudio: (t: string) => Promise<MockAudioElement> }).fetchChunkAudio =
    async () => new MockAudioElement();

  console.log("\n1. Starting speech via speakText...");
  const speakPromise = client.speakText(sampleText);

  // Allow microtasks to spin so first chunk is playing
  await new Promise((r) => setTimeout(r, 50));

  assert.strictEqual(client.getIsSpeaking(), true, "Client should be speaking");
  assert.strictEqual(client.getIsPaused(), false, "Client should not be paused initially");
  assert.strictEqual(client.getCurrentChunkIndex(), 0, "Chunk 0 should be active");
  console.log("✓ Speech started: isSpeaking=true, isPaused=false, chunk=0");

  console.log("\n2. Pausing playback mid-chunk...");
  // Simulate active audio playing at currentTime = 1.8 seconds
  const currentAudio = (client as unknown as { currentAudio: MockAudioElement | null }).currentAudio;
  assert.ok(currentAudio, "currentAudio should exist");
  currentAudio.currentTime = 1.8;

  client.pauseSpeaking();

  assert.strictEqual(client.getIsSpeaking(), true, "Session is still active while paused");
  assert.strictEqual(client.getIsPaused(), true, "isPaused must be true");
  assert.strictEqual(currentAudio.paused, true, "Audio element must be paused");
  assert.strictEqual(currentAudio.currentTime, 1.8, "currentTime must be preserved exactly at 1.8s");
  assert.strictEqual(client.getCurrentChunkIndex(), 0, "Current chunk index must remain 0 during pause");
  console.log("✓ Paused: audio element paused at 1.8s, chunk index retained at 0");

  console.log("\n3. Testing togglePlayPause while paused (should resume)...");
  client.togglePlayPause(sampleText);

  assert.strictEqual(client.getIsPaused(), false, "isPaused should now be false");
  assert.strictEqual(currentAudio.paused, false, "Audio element should have resumed playing");
  assert.strictEqual(currentAudio.currentTime, 1.8, "Audio resumes from 1.8s, not from 0");
  console.log("✓ Resumed: audio element playing from 1.8s without restarting from beginning");

  console.log("\n4. Simulating chunk 0 completion and advancing to chunk 1...");
  // Trigger audio onended to advance chunk loop
  currentAudio.onended?.();
  await new Promise((r) => setTimeout(r, 50));

  assert.strictEqual(client.getCurrentChunkIndex(), 1, "Should have advanced to chunk 1");
  console.log("✓ Advanced to chunk 1 seamlessly after resuming");

  console.log("\n5. Testing Restart functionality...");
  client.restartSpeaking(sampleText);
  await new Promise((r) => setTimeout(r, 50));

  assert.strictEqual(client.getCurrentChunkIndex(), 0, "Restarting resets chunk index to 0");
  assert.strictEqual(client.getIsPaused(), false, "isPaused should be false after restart");
  assert.strictEqual(client.getIsSpeaking(), true, "isSpeaking should be true after restart");
  console.log("✓ Restart successfully reset playback to chunk 0");

  console.log("\n6. Testing Stop functionality...");
  client.stopSpeaking();

  assert.strictEqual(client.getIsSpeaking(), false, "isSpeaking must be false after stop");
  assert.strictEqual(client.getIsPaused(), false, "isPaused must be false after stop");
  assert.strictEqual(client.getCurrentChunkIndex(), 0, "Current chunk index reset");
  console.log("✓ Stop successfully halted speech and reset all state");

  console.log("\n>>> ALL PLAY/PAUSE/RESUME TESTS PASSED! <<<");
}

testPlayPauseAndResume().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
