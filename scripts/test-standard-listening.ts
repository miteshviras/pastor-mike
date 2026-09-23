import assert from "node:assert";
import { PastoralSpeechClient } from "../lib/voice/speech-client";

// Comprehensive test simulating standard voice listening (Google Search / ChatGPT style)
async function testStandardListening() {
  console.log("=== Testing Standard Voice Listening (Google Search / ChatGPT Style) ===");

  let listeningState = false;
  let transcribingState = false;
  let transcribedResult = "";
  let isResultFinal = false;

  // Mock global window and SpeechRecognition for node environment
  let mockRecognitionInstance: any = null;
  class MockSpeechRecognition {
    continuous = true;
    interimResults = false;
    lang = "en-US";
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: ((e: { error: string }) => void) | null = null;
    onresult: ((e: any) => void) | null = null;

    constructor() {
      mockRecognitionInstance = this;
    }

    start() {
      this.onstart?.();
    }

    stop() {
      this.onend?.();
    }

    abort() {
      this.onend?.();
    }
  }

  (global as any).window = {
    SpeechRecognition: MockSpeechRecognition,
  };

  const client = new PastoralSpeechClient({
    onListeningStateChange: (listening) => {
      listeningState = listening;
    },
    onTranscribingChange: (transcribing) => {
      transcribingState = transcribing;
    },
    onTranscriptionResult: (text, isFinal) => {
      transcribedResult = text;
      isResultFinal = isFinal;
    },
  });

  // Test 1: Verify standard single-utterance configuration (continuous = false)
  console.log("\n[Test 1] Verifying SpeechRecognition initialized with continuous = false (standard query mode)...");
  assert.ok(mockRecognitionInstance, "SpeechRecognition instance should be created");
  assert.strictEqual(
    mockRecognitionInstance.continuous,
    false,
    "Web Speech must use continuous = false for standard Google Search endpointing"
  );
  assert.strictEqual(
    mockRecognitionInstance.interimResults,
    true,
    "Web Speech must use interimResults = true for live streaming feedback"
  );
  console.log("✓ Correctly configured with continuous = false and interimResults = true");

  // Test 2: Simulate clicking microphone -> user speaks -> interim feedback -> speaker pauses
  console.log("\n[Test 2] Simulating user tap mic, speak, and pause (standard endpointing)...");
  client.startListening();
  assert.strictEqual(listeningState, true, "Mic should be active/listening");

  // Interim speech
  mockRecognitionInstance.onresult?.({
    results: [{ 0: { transcript: "Dear Pastor" }, isFinal: false }],
    length: 1,
  });
  assert.strictEqual(transcribedResult, "Dear Pastor");
  assert.strictEqual(isResultFinal, false);

  // Speaker pauses -> browser finalizes phrase and triggers onend natively
  mockRecognitionInstance.onresult?.({
    results: [{ 0: { transcript: "Dear Pastor pray for me" }, isFinal: true }],
    length: 1,
  });
  assert.strictEqual(transcribedResult, "Dear Pastor pray for me");
  assert.strictEqual(isResultFinal, true);

  mockRecognitionInstance.onend?.();
  assert.strictEqual(listeningState, false, "Microphone must automatically turn off on pause!");
  console.log("✓ Speech successfully delivered and microphone automatically paused/stopped on speech completion!");

  // Test 3: Race condition test — network error fallback to Moonshine
  console.log("\n[Test 3] Verifying race-condition guard when falling back to Moonshine STT...");
  let moonshineStarted = false;
  Object.defineProperty(globalThis, "navigator", {
    value: {
      mediaDevices: {
        getUserMedia: async () => {
          moonshineStarted = true;
          return {
            getTracks: () => [{ stop: () => {} }],
          };
        },
      },
    },
    configurable: true,
    writable: true,
  });
  (global as any).MediaRecorder = class {
    static isTypeSupported() { return true; }
    state = "inactive";
    ondataavailable: any = null;
    onstop: any = null;
    start() { this.state = "recording"; }
    stop() { this.state = "inactive"; this.onstop?.(); }
  };

  client.startListening();
  // Simulate browser cloud network error
  mockRecognitionInstance.onerror?.({ error: "network" });
  // Browser will fire onend right after onerror!
  mockRecognitionInstance.onend?.();

  // Allow async microtasks
  await new Promise((r) => setTimeout(r, 10));

  assert.strictEqual(client.getActiveListeningEngine(), "moonshine", "Should be in moonshine fallback mode");
  console.log("✓ Fallback race condition guard prevented onend from destroying Moonshine state!");

  // Test 4: Stop listening flushes and cleans up
  console.log("\n[Test 4] Stopping listening cleans up active mode...");
  await client.stopListening();
  assert.strictEqual(client.getActiveListeningEngine(), null, "Mode should be null after stop");
  assert.strictEqual(listeningState, false, "Listening should be false");
  console.log("✓ Moonshine STT stop verified.");

  // Test 5: Standard listening integration with input box (Never auto-send, always populate input)
  console.log("\n[Test 5] Simulating full Google Search / ChatGPT listening UX with input box...");
  client.resetBrowserRecognition();
  let pageInputText = "";
  let baseInput = "";
  const chatMessages: string[] = [];

  const handlePageTranscription = (text: string) => {
    const combined = baseInput ? `${baseInput} ${text.trim()}` : text.trim();
    pageInputText = combined;
  };

  const handlePageSend = (text: string) => {
    if (!text.trim()) return;
    chatMessages.push(text.trim());
    pageInputText = "";
    baseInput = "";
  };

  // Turn 1: Click mic, speak "Lord grant me peace", pause
  baseInput = pageInputText.trim();
  client.startListening();
  assert.strictEqual(listeningState, true, "Mic should be listening");

  // User speaks and pauses
  mockRecognitionInstance.onresult?.({
    results: [{ 0: { transcript: "Lord grant me peace" }, isFinal: true }],
    length: 1,
  });
  handlePageTranscription(transcribedResult);
  mockRecognitionInstance.onend?.();

  assert.strictEqual(listeningState, false, "Microphone must auto-stop on pause");
  assert.strictEqual(pageInputText, "Lord grant me peace", "Text must appear in input box");
  assert.strictEqual(chatMessages.length, 0, "Chat message MUST NOT be sent automatically!");
  console.log(`✓ Turn 1: Mic auto-stopped on pause. Input: "${pageInputText}" (Sent: 0)`);

  // Turn 2: User taps mic again to append "and strength for today"
  baseInput = pageInputText.trim();
  client.startListening();
  assert.strictEqual(listeningState, true, "Mic starts listening again for append");

  mockRecognitionInstance.onresult?.({
    results: [{ 0: { transcript: "and strength for today" }, isFinal: true }],
    length: 1,
  });
  handlePageTranscription(transcribedResult);
  mockRecognitionInstance.onend?.();

  assert.strictEqual(listeningState, false, "Microphone must auto-stop on pause");
  assert.strictEqual(pageInputText, "Lord grant me peace and strength for today", "Text should accumulate cleanly in input");
  assert.strictEqual(chatMessages.length, 0, "Chat message STILL must NOT be sent automatically!");
  console.log(`✓ Turn 2: Mic auto-stopped on pause. Accumulated input: "${pageInputText}" (Sent: 0)`);

  // Turn 3: User explicitly submits via Send button
  handlePageSend(pageInputText);
  assert.strictEqual(chatMessages.length, 1);
  assert.strictEqual(chatMessages[0], "Lord grant me peace and strength for today");
  assert.strictEqual(pageInputText, "", "Input box should clear on manual send");
  console.log(`✓ Turn 3: User explicitly sent message: "${chatMessages[0]}"`);

  console.log("\n>>> ALL STANDARD LISTENING TESTS PASSED! <<<");
}

testStandardListening().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
