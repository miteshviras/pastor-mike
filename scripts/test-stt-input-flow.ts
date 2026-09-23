import assert from "node:assert";

// Simulation of the STT pause-to-input flow as implemented in app/page.tsx
function simulateSttInputFlow() {
  console.log("=== Testing STT Pause-To-Input Flow (No Auto-Send) ===");

  // State in page.tsx
  let inputText = "";
  const inputTextRef = { current: inputText };
  const baseInputRef = { current: "" };
  let isListening = false;
  const sentMessages: string[] = [];

  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;
    sentMessages.push(text.trim());
    inputText = "";
    inputTextRef.current = "";
    baseInputRef.current = "";
    if (isListening) {
      isListening = false;
    }
  };

  const setInputText = (val: string) => {
    inputText = val;
    inputTextRef.current = val;
  };

  // Turn 1: User starts speaking with empty input
  console.log("\n[Test 1] User starts listening with empty input...");
  isListening = true;
  baseInputRef.current = inputTextRef.current.trim();
  assert.strictEqual(baseInputRef.current, "");

  // Simulated transcription handler from PastoralSpeechClient
  const onTranscriptionResult = (transcript: string, isFinal: boolean) => {
    if (!transcript.trim()) return;
    // On each pause (isFinal = true), update input text; NEVER auto-send!
    if (isFinal) {
      const base = baseInputRef.current;
      const newText = base ? `${base} ${transcript.trim()}` : transcript.trim();
      setInputText(newText);
    }
  };

  // Speaker says phrase 1, then pauses
  console.log("[Test 2] Speaker says 'May peace be with you' and pauses...");
  onTranscriptionResult("May peace be with you", true);

  assert.strictEqual(inputText, "May peace be with you", "Input should show phrase 1 on pause");
  assert.strictEqual(sentMessages.length, 0, "Speech must NOT be sent automatically for chat!");
  console.log(`✓ Input correctly populated on pause 1: "${inputText}" (auto-send: NONE)`);

  // Speaker continues talking without stopping mic, then pauses again
  console.log("[Test 3] Speaker continues 'and grace abound' and pauses again...");
  onTranscriptionResult("May peace be with you and grace abound", true);

  assert.strictEqual(inputText, "May peace be with you and grace abound", "Input should update cumulatively on pause 2");
  assert.strictEqual(sentMessages.length, 0, "Speech still must NOT be sent automatically!");
  console.log(`✓ Input correctly updated on pause 2: "${inputText}" (auto-send: NONE)`);

  // Speaker edits the text using keyboard
  console.log("[Test 4] User edits text manually before sending...");
  setInputText(inputText + " always.");
  assert.strictEqual(inputText, "May peace be with you and grace abound always.");

  // User explicitly clicks Send button or hits Enter
  console.log("[Test 5] User clicks Send button...");
  handleSendMessage(inputText);

  assert.strictEqual(sentMessages.length, 1, "Message should now be sent upon user action");
  assert.strictEqual(sentMessages[0], "May peace be with you and grace abound always.");
  assert.strictEqual(inputText, "", "Input must be cleared after sending");
  assert.strictEqual(isListening, false, "Listening should stop when message is sent");
  console.log("✓ Message sent cleanly with input reset and mic stopped.");

  // Turn 2: User starts listening with preexisting text already typed in input
  console.log("\n[Test 6] User types 'Dear Pastor, ' then clicks microphone to speak...");
  setInputText("Dear Pastor,");
  isListening = true;
  baseInputRef.current = inputTextRef.current.trim();
  assert.strictEqual(baseInputRef.current, "Dear Pastor,");

  // Speaker says "please pray for my family" and pauses
  onTranscriptionResult("please pray for my family", true);
  assert.strictEqual(inputText, "Dear Pastor, please pray for my family");
  assert.strictEqual(sentMessages.length, 1, "Must NOT auto-send!");
  console.log(`✓ Appended to preexisting input on pause: "${inputText}"`);

  console.log("\n>>> ALL STT PAUSE-TO-INPUT FLOW TESTS PASSED! <<<");
}

simulateSttInputFlow();
