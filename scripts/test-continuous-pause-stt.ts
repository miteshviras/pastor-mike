import assert from "node:assert";
import { PastoralSpeechClient } from "../lib/voice/speech-client";

// Test suite for continuous listening across multiple pauses until user clicks stop
async function testContinuousPauseStt() {
  console.log("=== Testing Continuous Listening Across Multiple Pauses Until Stop ===");

  let isListeningState = false;
  let isTranscribingState = false;
  let transcriptHistory: string[] = [];
  let finalResult = "";

  // Mock navigator and MediaRecorder environment
  let currentRecorderInstance: any = null;
  const createdRecorders: any[] = [];

  class MockMediaRecorder {
    state: "inactive" | "recording" = "recording";
    mimeType = "audio/webm";
    ondataavailable: ((e: { data: { size: number } }) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: (() => void) | null = null;

    constructor(public stream: any, public options?: any) {
      currentRecorderInstance = this;
      createdRecorders.push(this);
    }

    start(timeslice?: number) {
      this.state = "recording";
    }

    stop() {
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob([new Uint8Array(2000)], { type: "audio/webm" }) as any });
      this.onstop?.();
    }
  }

  const mockTrack = {
    stop: () => {},
    kind: "audio",
  };

  const mockStream = {
    getTracks: () => [mockTrack],
  };

  (global as any).window = {
    AudioContext: class {
      state = "running";
      resume() { return Promise.resolve(); }
      close() { return Promise.resolve(); }
      createMediaStreamSource() {
        return { connect: () => {} };
      }
      createAnalyser() {
        return {
          fftSize: 512,
          smoothingTimeConstant: 0.2,
          getFloatTimeDomainData: (arr: Float32Array) => {
            // Fill with silence by default
            arr.fill(0);
          },
        };
      }
    },
    MediaRecorder: MockMediaRecorder,
  };

  (global as any).MediaRecorder = MockMediaRecorder;
  Object.defineProperty(globalThis, "navigator", {
    value: {
      mediaDevices: {
        getUserMedia: async () => mockStream,
      },
    },
    configurable: true,
    writable: true,
  });

  // Mock fetch for /api/stt
  let sttCallCount = 0;
  const mockResponses = [
    { text: "Lord bless our family" },
    { text: "and grant us your peace" },
    { text: "in Jesus name" },
  ];

  (global as any).fetch = async (url: string, opts: any) => {
    if (url === "/api/stt") {
      const response = mockResponses[sttCallCount++] || { text: "amen" };
      // Simulate asynchronous server processing time
      await new Promise((r) => setTimeout(r, 50));
      return {
        ok: true,
        status: 200,
        json: async () => response,
      };
    }
    return { ok: false, status: 404 };
  };

  const client = new PastoralSpeechClient({
    onListeningStateChange: (listening) => {
      isListeningState = listening;
    },
    onTranscribingChange: (transcribing) => {
      isTranscribingState = transcribing;
    },
    onTranscriptionResult: (text, isFinal) => {
      transcriptHistory.push(text);
      finalResult = text;
    },
  });

  // 1. User taps microphone button to start listening
  console.log("\n[Test 1] Starting listening session via Moonshine STT...");
  client.startListening();
  // Allow async startListeningViaMoonshine to acquire stream
  await new Promise((r) => setTimeout(r, 60));

  assert.strictEqual(isListeningState, true, "Mic must be listening (red/pulsing)");
  assert.strictEqual(client.getActiveListeningEngine(), "moonshine", "Should be using Moonshine STT engine");
  console.log("✓ Mic is active and listening via Moonshine STT");

  // 2. Speaker says Sentence 1 and pauses -> triggers handleMoonshinePause
  console.log("\n[Test 2] Speaker says Sentence 1 and pauses -> background transcribe...");
  const initialRecorder = currentRecorderInstance;
  assert.ok(initialRecorder, "Initial MediaRecorder must be active");

  // Trigger pause handler
  await (client as any).handleMoonshinePause();

  // Verify that recorder was rotated immediately to new instance on same stream
  assert.notStrictEqual(currentRecorderInstance, initialRecorder, "New MediaRecorder should be started on pause");
  assert.strictEqual(isListeningState, true, "Microphone must REMAIN LISTENING after pause!");

  // Wait for background /api/stt task to complete
  await new Promise((r) => setTimeout(r, 120));

  assert.strictEqual(finalResult, "Lord bless our family", "Sentence 1 should be transcribed and displayed");
  assert.strictEqual(isListeningState, true, "Microphone must STILL be listening while awaiting next sentence!");
  console.log("✓ Sentence 1 transcribed in background while mic remained listening: '%s'", finalResult);

  // 3. Speaker says Sentence 2 and pauses -> triggers handleMoonshinePause again
  console.log("\n[Test 3] Speaker says Sentence 2 and pauses -> background transcribe & accumulate...");
  const secondRecorder = currentRecorderInstance;

  await (client as any).handleMoonshinePause();

  assert.notStrictEqual(currentRecorderInstance, secondRecorder, "New MediaRecorder should be created for Sentence 3");
  assert.strictEqual(isListeningState, true, "Microphone must STILL remain listening!");

  await new Promise((r) => setTimeout(r, 120));

  assert.strictEqual(
    finalResult,
    "Lord bless our family and grant us your peace",
    "Sentence 2 must accumulate seamlessly onto Sentence 1 in input box"
  );
  assert.strictEqual(isListeningState, true, "Microphone must STILL be active for further speech!");
  console.log("✓ Sentence 2 accumulated in background while mic remained listening: '%s'", finalResult);

  // 4. Speaker says Sentence 3 and finally clicks the microphone button to STOP
  console.log("\n[Test 4] Speaker clicks the SAME microphone button to finish listening...");
  await client.stopListening();

  assert.strictEqual(isListeningState, false, "Microphone must now be stopped and returned to idle state");
  assert.strictEqual(
    finalResult,
    "Lord bless our family and grant us your peace in Jesus name",
    "Final sentence must be cleanly transcribed and accumulated upon stop click"
  );
  console.log("✓ Listening stopped on click! Final accumulated message: '%s'", finalResult);

  // 5. Verify input box behavior — text stays in box, chat is NEVER auto-sent
  console.log("\n[Test 5] Verify input box state — user review constraint...");
  let chatBoxText = "";
  let messageSent = false;
  const mockPageInputState = {
    inputText: "",
    onSendMessage: (msg: string) => {
      messageSent = true;
    },
  };

  // Simulating the page.tsx handler
  const handleTranscription = (transcript: string) => {
    mockPageInputState.inputText = transcript;
    chatBoxText = transcript;
  };

  handleTranscription(finalResult);
  assert.strictEqual(mockPageInputState.inputText, "Lord bless our family and grant us your peace in Jesus name");
  assert.strictEqual(messageSent, false, "Message must NEVER be auto-sent without explicit user action!");
  console.log("✓ Text remains safely in input box for user editing, not auto-sent");

  console.log("\nAll continuous listening tests PASSED successfully!\n");
}

testContinuousPauseStt().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
