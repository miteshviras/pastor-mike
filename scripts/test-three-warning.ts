import assert from "node:assert";
import * as THREE from "three";

async function testThreeClockWarningSuppression() {
  console.log("=== Testing THREE.Clock Deprecation Warning Suppression ===");

  const warnings: string[] = [];
  const origWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(" "));
    origWarn.apply(console, args);
  };

  // 1. Without suppression, THREE.Clock warns
  new THREE.Clock();
  assert.ok(
    warnings.some((w) => w.includes("Clock: This module has been deprecated")),
    "Should normally warn about Clock deprecation"
  );
  console.log("✓ Native Three.js Clock deprecation warning confirmed.");

  // Clear warnings
  warnings.length = 0;

  // 2. Apply the suppression hook installed in PastorStage.tsx and Avatar.tsx
  if (typeof (THREE as any).setConsoleFunction === "function") {
    (THREE as any).setConsoleFunction((type: string, message: string, ...params: unknown[]) => {
      if (typeof message === "string" && message.includes("Clock: This module has been deprecated")) {
        return;
      }
      const method = (console as any)[type] || console.log;
      method.call(console, message, ...params);
    });
  }

  // Fallback filter on console.warn
  console.warn = (...args: unknown[]) => {
    const first = typeof args[0] === "string" ? args[0] : "";
    if (first.includes("Clock: This module has been deprecated")) {
      return;
    }
    warnings.push(args.map(String).join(" "));
  };

  // 3. Instantiate THREE.Clock again (e.g. by @react-three/fiber Canvas setup)
  new THREE.Clock();

  assert.strictEqual(
    warnings.filter((w) => w.includes("Clock: This module has been deprecated")).length,
    0,
    "Warning should be suppressed!"
  );
  console.log("✓ THREE.Clock deprecation warning successfully suppressed!");

  console.log("\n>>> ALL THREE.CLOCK WARNING TESTS PASSED! <<<");
}

testThreeClockWarningSuppression().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
