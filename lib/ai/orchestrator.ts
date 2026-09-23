import { evaluateSafety, SafetyCheckResult } from "./safety";
import { OFFLINE_TOPIC_TEMPLATES } from "./pastoral-prompt";
import { searchScripture, ScriptureVerse } from "../scripture/bible-data";
import { saveMessage, getOrCreateDefaultUser, getProviderSettings, getRecentContext, savePrayerRequest } from "../db";
import { generateDynamicPastoralResponse } from "./dynamic-pastoral-engine";

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
  prompt: string,
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
          contents: prompt,
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
  prompt: string,
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
  const primaryVerse = scriptures[0];

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
  if (primaryVerse) {
    contextLines.push(`Relevant Scripture anchor from Bible database: ${primaryVerse.reference} ("${primaryVerse.text}").`);
  }

  const pastoralSystemPrompt = `You are Pastor Mike, a warm, compassionate, non-judgmental AI pastoral companion.
You speak gently, offer empathetic reflection, cite Holy Scripture thoughtfully, and prepare a sincere, heartfelt prayer.
Always maintain transparent disclosure that you are an AI companion providing spiritual encouragement, not an ordained human minister.
Every reply is read aloud, so write in short plain sentences with no markdown, emojis, bullet points, or decorative formatting, and let scripture references read naturally in a sentence rather than as a heading or citation.
${contextLines.join(" ")}`;

  // User-selected backend (Settings). Defaults to Gemini.
  const providerSettings = getProviderSettings(userId);

  let replyText = "";
  let usedModel: "gemini" | "ollama" | "local-offline-engine" = "local-offline-engine";
  let activePrayer = template.prayer;

  if (providerSettings.provider === "gemini") {
    const geminiReply = await tryGeminiChat(userMessage, pastoralSystemPrompt, providerSettings.geminiModel);
    if (geminiReply) {
      replyText = geminiReply;
      usedModel = "gemini";
    }
  } else if (providerSettings.provider === "ollama") {
    const ollamaReply = await tryOllamaChat(userMessage, pastoralSystemPrompt, providerSettings.ollamaModel);
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

  return {
    reply: replyText,
    scriptures,
    prayer: activePrayer,
    safety,
    savedPrayerId,
    usedModel,
  };
}
