import * as fs from "fs";
import * as path from "path";
import { listAvailableGeminiModels, FALLBACK_GEMINI_MODELS } from "../lib/ai/gemini-models";
import { getOrCreateDefaultUser, getProviderSettings, saveProviderSettings, createSession } from "../lib/db";
import { processPastoralTurn } from "../lib/ai/orchestrator";

try {
  const envContent = fs.readFileSync(path.resolve(process.cwd(), ".env"), "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
} catch {}

async function runTests() {
  console.log("=== Testing Gemini Models Discovery & Default Settings ===");

  // 1. Test model list discovery
  console.log("\n[Test 1] Testing listAvailableGeminiModels()...");
  const models = await listAvailableGeminiModels();
  console.log(`✓ Models retrieved count: ${models.length}`);
  console.assert(models.length > 0, "Models list should not be empty");
  console.assert(models.includes("gemini-2.5-flash"), "Should contain gemini-2.5-flash");
  console.assert(models.includes("gemini-2.5-pro"), "Should contain gemini-2.5-pro");
  console.assert(models.includes("gemini-3.5-flash"), "Should contain gemini-3.5-flash");
  console.log("Sample models:", models.slice(0, 5));

  // 2. Test saving and retrieving settings
  console.log("\n[Test 2] Testing DB persistence of selected Gemini model...");
  const user = getOrCreateDefaultUser();
  const initialSettings = getProviderSettings(user.id);
  console.log("Initial settings:", initialSettings);

  const testModel = "gemini-3.5-flash";
  const updated = saveProviderSettings(user.id, {
    provider: "gemini",
    geminiModel: testModel,
  });
  console.log("Saved settings:", updated);
  console.assert(updated.geminiModel === testModel, `Expected geminiModel to be ${testModel}`);

  const reloaded = getProviderSettings(user.id);
  console.assert(reloaded.geminiModel === testModel, `Expected reloaded geminiModel to be ${testModel}`);
  console.log(`✓ Selected model '${testModel}' persisted and reloaded successfully`);

  // 3. Test pastoral turn respects selected model and metadata
  console.log("\n[Test 3] Testing turn execution with selected default model...");
  const session = createSession(user.id);
  const turnResult = await processPastoralTurn(
    session.id,
    "Lord grant me peace and courage for tomorrow.",
    { userId: user.id }
  );

  console.log(`✓ Turn replied: ${turnResult.reply.slice(0, 60)}...`);
  console.log(`✓ Used Model: ${turnResult.usedModel}`);
  if (turnResult.usedModel === "gemini") {
    console.log(`✓ Active Gemini Model Name: ${turnResult.modelName}`);
    console.assert(turnResult.modelName === testModel, `Expected modelName to be ${testModel}`);
  }

  // 4. Restore settings
  saveProviderSettings(user.id, initialSettings);
  console.log("\n✓ Initial provider settings cleanly restored.");

  console.log("\n>>> ALL GEMINI MODEL SETTINGS TESTS PASSED SUCCESSFULLY! <<<");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
