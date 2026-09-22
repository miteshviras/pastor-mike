import { searchScripture, getVerseByReference } from "../lib/scripture/bible-data";
import assert from "node:assert";

console.log("=== Testing Scripture Knowledge Base & Search ===");

// 1. Direct Reference Lookup
const phil = getVerseByReference("Philippians 4:6-7");
assert.ok(phil, "Direct reference Philippians 4:6-7 should be found");
assert.strictEqual(phil?.reference, "Philippians 4:6-7");
console.log("1. Direct reference found:", phil?.reference, "-", phil?.text.substring(0, 40) + "...");

// 2. Search by Topic (Anxiety)
const anxietyResults = searchScripture("anxiety work stress");
assert.ok(anxietyResults.length > 0, "Should find verses for anxiety");
console.log("2. Anxiety search results:", anxietyResults.map(v => v.reference));
assert.ok(anxietyResults.some(v => v.reference.includes("Philippians") || v.reference.includes("Peter")));

// 3. Search by Grief & Loss
const griefResults = searchScripture("grief and broken heart");
assert.ok(griefResults.length > 0, "Should find verses for grief");
console.log("3. Grief search results:", griefResults.map(v => v.reference));
assert.ok(griefResults.some(v => v.reference.includes("34:18") || v.reference.includes("Matthew 5:4")));

// 4. Search by Burnout & Rest
const restResults = searchScripture("tired and burnout from labor");
assert.ok(restResults.length > 0, "Should find verses for rest");
console.log("4. Rest search results:", restResults.map(v => v.reference));
assert.strictEqual(restResults[0].reference, "Matthew 11:28-30");

console.log("\n>>> ALL SCRIPTURE TESTS PASSED SUCCESSFULLY! <<<");
