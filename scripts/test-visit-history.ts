import {
  getOrCreateDefaultUser,
  createSession,
  saveMessage,
  savePrayerRequest,
  listPrayerRequests,
  listSessionsWithStats,
  deletePrayerRequest,
  deleteSession,
} from "../lib/db";

async function runTest() {
  console.log("=== Testing Visit History & Visit-Scoped Prayer Journal ===");

  const user = getOrCreateDefaultUser();
  console.log(`User: ${user.display_name} (${user.id})`);

  // 1. Create Visit A
  const sessionA = createSession(user.id);
  console.log(`Created Visit A: ${sessionA.id}`);

  saveMessage(sessionA.id, "user", "Hello Pastor Mike, my mother is undergoing surgery tomorrow.");
  saveMessage(sessionA.id, "assistant", "Peace be with you. I will hold your mother in prayer.");

  // Add prayer for Visit A
  const prayerA = savePrayerRequest(user.id, "Healing and peace for my mother's surgery tomorrow", sessionA.id);
  console.log(`Added Prayer for Visit A: ${prayerA.id}`);

  // 2. Verify Visit A prayer list contains only Prayer A
  const prayersA = listPrayerRequests(user.id, sessionA.id);
  console.log(`Visit A prayers count: ${prayersA.length}`);
  if (prayersA.length !== 1 || prayersA[0].id !== prayerA.id) {
    throw new Error(`Visit A expected exactly 1 prayer (${prayerA.id}), got ${prayersA.length}`);
  }

  // 3. Create Visit B (Brand New Visit)
  const sessionB = createSession(user.id);
  console.log(`Created Visit B (Brand New Visit): ${sessionB.id}`);

  saveMessage(sessionB.id, "user", "I am feeling overwhelmed with work this week.");
  saveMessage(sessionB.id, "assistant", "Come unto me, all ye that labour and are heavy laden, and I will give you rest.");

  // 4. Verify Visit B has NO prefilled prayers (starts clean)
  const prayersB_initial = listPrayerRequests(user.id, sessionB.id);
  console.log(`Visit B initial prayers count (must be 0): ${prayersB_initial.length}`);
  if (prayersB_initial.length !== 0) {
    throw new Error(`Visit B should have 0 prayers initially, but had ${prayersB_initial.length}`);
  }

  // 5. Add prayer for Visit B
  const prayerB = savePrayerRequest(user.id, "Strength and patience in my workplace", sessionB.id);
  console.log(`Added Prayer for Visit B: ${prayerB.id}`);

  // 6. Verify isolation between Visit A and Visit B
  const prayersA_after = listPrayerRequests(user.id, sessionA.id);
  const prayersB_after = listPrayerRequests(user.id, sessionB.id);

  console.log(`Visit A prayers after Visit B added: ${prayersA_after.length}`);
  console.log(`Visit B prayers after Visit B added: ${prayersB_after.length}`);

  if (prayersA_after.length !== 1 || prayersA_after[0].id !== prayerA.id) {
    throw new Error("Visit A prayers leaked or changed!");
  }
  if (prayersB_after.length !== 1 || prayersB_after[0].id !== prayerB.id) {
    throw new Error("Visit B prayers leaked or incorrect!");
  }

  // 7. Verify listSessionsWithStats returns stats for both visits
  const stats = listSessionsWithStats(user.id);
  const statA = stats.find((s) => s.id === sessionA.id);
  const statB = stats.find((s) => s.id === sessionB.id);

  if (!statA || !statB) {
    throw new Error("Could not find session stats for A or B");
  }

  console.log("Visit A stats:", {
    messages: statA.messageCount,
    prayers: statA.prayerCount,
    preview: statA.firstMessagePreview,
  });
  console.log("Visit B stats:", {
    messages: statB.messageCount,
    prayers: statB.prayerCount,
    preview: statB.firstMessagePreview,
  });

  if (statA.prayerCount !== 1 || statB.prayerCount !== 1) {
    throw new Error("Prayer counts in session stats mismatch!");
  }
  if (statA.messageCount !== 2 || statB.messageCount !== 2) {
    throw new Error("Message counts in session stats mismatch!");
  }
  if (!statA.firstMessagePreview?.includes("surgery")) {
    throw new Error("Visit A preview missing first user message content!");
  }

  // 8. Test deleting a prayer
  deletePrayerRequest(prayerB.id);
  const prayersB_del = listPrayerRequests(user.id, sessionB.id);
  if (prayersB_del.length !== 0) throw new Error("Prayer B was not deleted");
  console.log("Prayer B successfully deleted.");

  // 9. Test deleting a session (Visit B)
  const delSessionResult = deleteSession(sessionB.id);
  if (!delSessionResult) throw new Error("deleteSession returned false");
  const statsAfterDelete = listSessionsWithStats(user.id);
  if (statsAfterDelete.some((s) => s.id === sessionB.id)) {
    throw new Error("Session B still exists after deletion");
  }
  console.log("Session B successfully deleted.");

  // Cleanup session A
  deleteSession(sessionA.id);
  console.log("Session A successfully cleaned up.");

  console.log("✅ ALL VISIT HISTORY & PRAYER JOURNAL ISOLATION TESTS PASSED!");
}

runTest().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
