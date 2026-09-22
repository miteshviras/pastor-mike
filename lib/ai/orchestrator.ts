import { evaluateSafety, SafetyCheckResult } from "./safety";
import { OFFLINE_TOPIC_TEMPLATES } from "./pastoral-prompt";
import { executeMcpTool } from "../mcp/tools";
import { ScriptureVerse } from "../scripture/bible-data";
import { saveMessage, getOrCreateDefaultUser } from "../db";

export interface PastoralResponse {
  reply: string;
  scriptures: ScriptureVerse[];
  prayer?: {
    title: string;
    text: string;
  };
  safety: SafetyCheckResult;
  savedPrayerId?: string;
  usedModel: "ollama" | "local-offline-engine";
}

// Helper to query local Ollama if running
async function tryOllamaChat(
  prompt: string,
  systemPrompt: string,
  model = "llama3.2"
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        stream: false,
      }),
    });

    clearTimeout(timeout);
    if (!res.ok) return null;

    const data = await res.json();
    return data.message?.content || null;
  } catch {
    return null;
  }
}

export async function processPastoralTurn(
  sessionId: string,
  userMessage: string,
  options?: { userId?: string }
): Promise<PastoralResponse> {
  const defaultUser = getOrCreateDefaultUser();
  const userId = options?.userId || defaultUser.id;

  // 1. Persist User Message
  saveMessage(sessionId, "user", userMessage);

  // 2. Safety & Boundary Check
  const safety = evaluateSafety(userMessage);

  if (safety.isCrisis) {
    const reply = safety.crisisResponse || "Please connect with emergency services immediately.";
    saveMessage(sessionId, "assistant", reply, { isCrisis: true });
    return {
      reply,
      scriptures: [],
      safety,
      usedModel: "local-offline-engine",
    };
  }

  if (safety.isProphecyRefusal) {
    const reply = `Beloved, as an AI pastoral companion, I cannot tell your future, foresee tomorrow's events, or deliver direct prophetic declarations. God gives us wisdom in His scriptures to live faithfully today, one step at a time.\n\n"Your word is a lamp to my feet, and a light for my path" (Psalm 119:105). May we instead pray together for discernment and peace for the choices before you?`;
    saveMessage(sessionId, "assistant", reply, { isProphecyRefusal: true });
    return {
      reply,
      scriptures: [],
      safety,
      usedModel: "local-offline-engine",
    };
  }

  // 3. Determine Emotional Topic & Intent
  const lowerMsg = userMessage.toLowerCase();
  let matchedTopic: keyof typeof OFFLINE_TOPIC_TEMPLATES = "general";

  if (/anxi|worry|stress|overwhelm|deadline|work|job|boss|pressure|panic/.test(lowerMsg)) {
    matchedTopic = "anxiety";
  } else if (/grie|death|died|loss|lost|mourn|crying|sad|heartbreak|funeral/.test(lowerMsg)) {
    matchedTopic = "grief";
  } else if (/burnout|tired|exhaust|sleep|rest|drained|weary|heavy/.test(lowerMsg)) {
    matchedTopic = "rest";
  } else if (/guid|path|decision|choice|future|career|confus|what should i do/.test(lowerMsg)) {
    matchedTopic = "guidance";
  }

  const template = OFFLINE_TOPIC_TEMPLATES[matchedTopic];

  // 4. Execute MCP Scripture Search
  const scriptureToolResult = await executeMcpTool("search_scripture", {
    topic_or_keyword: template.scriptureQuery,
  });

  const scriptures: ScriptureVerse[] = (scriptureToolResult.data as { verses: ScriptureVerse[] })?.verses || [];
  const primaryVerse = scriptures[0];

  // 5. Check if user explicitly asked for prayer or mentioned a prayer request
  let savedPrayerId: string | undefined;
  if (/pray|prayer|interced|please pray|hold in prayer/.test(lowerMsg)) {
    const prayerRes = await executeMcpTool("save_prayer_request", {
      text: userMessage,
      session_id: sessionId,
    }, { userId, sessionId });

    if (prayerRes.success) {
      savedPrayerId = (prayerRes.data as { id: string }).id;
    }
  }

  // 6. Try Local Ollama LLM first
  const ollamaReply = await tryOllamaChat(userMessage, "You are Pastor Mike. Respond with compassion, quote a scripture, and offer a short prayer.");

  let replyText = "";
  let usedModel: "ollama" | "local-offline-engine" = "local-offline-engine";

  if (ollamaReply) {
    replyText = ollamaReply;
    usedModel = "ollama";
  } else {
    // 7. Robust Offline Pastoral Engine (zero external dependencies)
    usedModel = "local-offline-engine";
    const scriptureExcerpt = primaryVerse
      ? `As it is written in **${primaryVerse.reference}** (${primaryVerse.translation}):\n> *"${primaryVerse.text}"*`
      : "";

    replyText = `${template.empathy}\n\n${template.counsel}\n\n${scriptureExcerpt}\n\nI have prepared a prayer for you below. Would you like to pause and pray this with me now?`;
  }

  // 8. Persist Assistant Response in SQLite
  saveMessage(sessionId, "assistant", replyText, {
    scriptures,
    prayer: template.prayer,
    usedModel,
    savedPrayerId,
  });

  return {
    reply: replyText,
    scriptures,
    prayer: template.prayer,
    safety,
    savedPrayerId,
    usedModel,
  };
}
