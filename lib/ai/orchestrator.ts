import { evaluateSafety, SafetyCheckResult } from "./safety";
import { OFFLINE_TOPIC_TEMPLATES } from "./pastoral-prompt";
import { searchScripture, ScriptureVerse } from "../scripture/bible-data";
import {
  saveMessage,
  getOrCreateDefaultUser,
  getProviderSettings,
  getRecentContext,
  savePrayerRequest,
  countUserMessages,
  getSessionMessages,
  saveConversationSummary,
  saveMemory,
  AiProviderSettings,
} from "../db";
import { generateDynamicPastoralResponse } from "./dynamic-pastoral-engine";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

// Last N messages of this visit (already includes the current turn — called after saveMessage),
// so the model sees this conversation's own prior turns instead of treating every call as the
// first message. Capped to bound token usage on long visits.
function getHistoryTurns(sessionId: string, limit = 20): ChatTurn[] {
  return getSessionMessages(sessionId)
    .slice(-limit)
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
}

export interface PastoralResponse {
  reply: string;
  scriptures: ScriptureVerse[];
  prayer?: {
    title: string;
    text: string;
  };
  safety: SafetyCheckResult;
  savedPrayerId?: string;
  usedModel: "gemini" | "ollama" | "local-offline-engine";
}

// Helper to query Google Gemini API if API key is provided
async function tryGeminiChat(
  history: ChatTurn[],
  systemPrompt: string,
  model = process.env.GEMINI_MODEL || "gemma-4-26b-a4b-it"
): Promise<string | null> {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY;

  if (!apiKey) return null;

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    // Gemini's turn roles are "user"/"model", not "user"/"assistant".
    const contents = history.map((t) => ({
      role: t.role === "assistant" ? "model" : "user",
      parts: [{ text: t.content }],
    }));

    // Try requested model first, then fallback to current modern Google models
    const candidates = Array.from(new Set([
      model,
      "gemma-4-26b-a4b-it",
      "gemini-3.5-flash",
      "gemini-3.6-flash",
      "gemini-3.7-flash",
      "gemini-flash-latest",
      "gemini-3.8-flash",
      "gemma-4-31b-it",
    ]));

    for (const candidate of candidates) {
      try {
        const response = await ai.models.generateContent({
          model: candidate,
          contents,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.7,
          },
        });

        if (response.text) {
          return response.text;
        }
      } catch (innerErr: any) {
        // Continue to next candidate if model is busy, deprecated, or not found
        console.warn(`Gemini candidate '${candidate}' failed (${innerErr?.message?.slice(0, 80) || innerErr}), trying next candidate...`);
        // Brief 250ms backoff before trying next candidate
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    return null;
  } catch (err) {
    console.warn("Gemini API call failed, falling back to local engine:", err);
    return null;
  }
}

// Helper to query local Ollama if running
async function tryOllamaChat(
  history: ChatTurn[],
  systemPrompt: string,
  model = process.env.OLLAMA_MODEL || "llama3.2"
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const baseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
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

const MEMORY_EXTRACTION_SYSTEM_PROMPT = `Given a short pastoral conversation exchange, respond with ONLY compact JSON, no markdown and no commentary, in this exact shape: {"summary": "1-2 sentence summary of this visit so far, building on the prior summary if one is given", "preferredName": "their first name if mentioned in this exchange, otherwise omit this key entirely"}.`;

// Best-effort: updates the cross-session summary/memory after a Gemini or Ollama reply,
// reusing whichever provider just answered. Never awaited by the caller — must not add
// latency to, or ever break, the actual reply the user is waiting on.
async function updateMemoryAfterTurn(params: {
  sessionId: string;
  userId: string;
  provider: "gemini" | "ollama";
  providerSettings: AiProviderSettings;
  priorSummary?: string;
  userMessage: string;
  replyText: string;
}): Promise<void> {
  try {
    const { sessionId, userId, provider, providerSettings, priorSummary, userMessage, replyText } = params;

    const extractionContent = [
      priorSummary ? `Prior summary of earlier visits: ${priorSummary}` : null,
      `Latest exchange — Them: "${userMessage}" You: "${replyText}"`,
    ].filter(Boolean).join("\n");

    const history: ChatTurn[] = [{ role: "user", content: extractionContent }];

    const raw = provider === "gemini"
      ? await tryGeminiChat(history, MEMORY_EXTRACTION_SYSTEM_PROMPT, providerSettings.geminiModel)
      : await tryOllamaChat(history, MEMORY_EXTRACTION_SYSTEM_PROMPT, providerSettings.ollamaModel);

    if (!raw) return;
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return;

    const parsed = JSON.parse(match[0]) as { summary?: string; preferredName?: string };
    if (parsed.summary?.trim()) {
      saveConversationSummary(sessionId, parsed.summary.trim());
    }
    if (parsed.preferredName?.trim()) {
      saveMemory(userId, "preferred_name", parsed.preferredName.trim());
    }
  } catch (err) {
    console.warn("[orchestrator] Memory extraction skipped:", err);
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

  // Each LLM call below is stateless (no prior turns sent), so the model can't tell this
  // apart from a first message on its own — decide it deterministically here instead.
  const isFirstMessageInVisit = countUserMessages(sessionId) === 1;

  // This visit's own turns so far (includes the just-saved current message) — without this,
  // every call looked like the start of a brand-new conversation, even mid-visit.
  const historyTurns = getHistoryTurns(sessionId);

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

  // 3. Pull what we already know about this believer (memories, active prayers, past summaries)
  const recentContext = getRecentContext(userId);
  const preferredName = recentContext.memories["preferred_name"];

  // 4. Determine Emotional Topic & Intent
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

  // 5. Scripture search — enriched with the believer's own words, not just the topic bucket
  const scriptures: ScriptureVerse[] = searchScripture(`${template.scriptureQuery} ${userMessage}`);

  // 6. Check if user explicitly asked for prayer or mentioned a prayer request
  let savedPrayerId: string | undefined;
  if (/pray|prayer|interced|please pray|hold in prayer/.test(lowerMsg)) {
    const prayer = savePrayerRequest(userId, userMessage, sessionId);
    savedPrayerId = prayer.id;
  }

  // 7. Model Selection Hierarchy:
  // 1st: Google Gemini API (if GEMINI_API_KEY or GOOGLE_API_KEY is configured)
  // 2nd: Local Ollama LLM (if running)
  // 3rd: Robust Dynamic Pastoral Reasoning Engine (local-offline-engine)
  const contextLines: string[] = [];
  if (preferredName) contextLines.push(`They prefer to be called ${preferredName}.`);
  if (recentContext.activePrayers.length > 0) {
    contextLines.push(`Active prayer requests you are already holding for them: ${recentContext.activePrayers.slice(0, 3).join("; ")}.`);
  }
  if (recentContext.recentSummaries.length > 0) {
    contextLines.push(`Summary of your last visit together: ${recentContext.recentSummaries[0]}.`);
  }
  if (scriptures.length > 0) {
    const anchors = scriptures.slice(0, 2)
      .map((v) => `${v.reference} ("${v.text}")`)
      .join("; ");
    contextLines.push(`Scripture anchors matched to what they just said — quote from one of these rather than choosing your own verse: ${anchors}.`);
  }

  const disclosureLine = isFirstMessageInVisit
    ? "Briefly mention once, naturally, that you are an AI companion offering spiritual encouragement, not an ordained human minister."
    : "Do not repeat the AI-companion disclosure — you already gave it earlier in this visit.";

  const pastoralSystemPrompt = `You are Pastor Mike, a warm, compassionate, non-judgmental AI pastoral companion.
You speak gently and cite Holy Scripture thoughtfully.
${disclosureLine}
Keep the reply short and meaningful: 2 short paragraphs at most, no padding or repeated reassurance, then a brief prayer.
Every reply is read aloud, so write in short plain sentences with no markdown, emojis, bullet points, or decorative formatting, and let scripture references read naturally in a sentence rather than as a heading or citation.
${contextLines.join(" ")}`;

  // User-selected backend (Settings). Defaults to Gemini.
  const providerSettings = getProviderSettings(userId);

  let replyText = "";
  let usedModel: "gemini" | "ollama" | "local-offline-engine" = "local-offline-engine";
  let activePrayer = template.prayer;

  if (providerSettings.provider === "gemini") {
    const geminiReply = await tryGeminiChat(historyTurns, pastoralSystemPrompt, providerSettings.geminiModel);
    if (geminiReply) {
      replyText = geminiReply;
      usedModel = "gemini";
    }
  } else if (providerSettings.provider === "ollama") {
    const ollamaReply = await tryOllamaChat(historyTurns, pastoralSystemPrompt, providerSettings.ollamaModel);
    if (ollamaReply) {
      replyText = ollamaReply;
      usedModel = "ollama";
    }
  }
  // providerSettings.provider === "offline" skips both external calls entirely

  // 8. Robust Dynamic Pastoral Reasoning Engine — always computed for its tailored prayer card;
  // also supplies the reply text itself when no external model was selected/available.
  const dynamicTurn = generateDynamicPastoralResponse(userMessage, scriptures, {
    preferredName,
    activePrayers: recentContext.activePrayers,
    recentSummaries: recentContext.recentSummaries,
  });
  activePrayer = dynamicTurn.prayer;
  if (!replyText) {
    replyText = dynamicTurn.reply;
    usedModel = "local-offline-engine";
  }

  // 9. Persist Assistant Response in SQLite
  saveMessage(sessionId, "assistant", replyText, {
    scriptures,
    prayer: activePrayer,
    usedModel,
    savedPrayerId,
  });

  // 10. Cross-session memory: best-effort, not awaited — must not add latency to this reply.
  if (usedModel === "gemini" || usedModel === "ollama") {
    void updateMemoryAfterTurn({
      sessionId,
      userId,
      provider: usedModel,
      providerSettings,
      priorSummary: recentContext.recentSummaries[0],
      userMessage,
      replyText,
    });
  }

  return {
    reply: replyText,
    scriptures,
    prayer: activePrayer,
    safety,
    savedPrayerId,
    usedModel,
  };
}
