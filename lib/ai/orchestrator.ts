import { evaluateSafety, SafetyCheckResult } from "./safety";
import { OFFLINE_TOPIC_TEMPLATES } from "./pastoral-prompt";
import { executeMcpTool } from "../mcp/tools";
import { ScriptureVerse } from "../scripture/bible-data";
import { saveMessage, getOrCreateDefaultUser, getActiveMcpClient } from "../db";
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
  mcp?: {
    isConnected: boolean;
    clientName: string;
    transport: string;
    toolsCalled: string[];
  };
}

// Helper to query Google Gemini API if API key is provided
async function tryGeminiChat(
  prompt: string,
  systemPrompt: string,
  model = process.env.GEMINI_MODEL || "gemini-2.5-flash"
): Promise<string | null> {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY;

  if (!apiKey) return null;

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      },
    });

    return response.text || null;
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

  // Tools tracking for MCP status and execution logs
  const toolsExecuted: string[] = [];

  // 3. Pull what we already know about this believer via MCP (memories, active prayers, past summaries)
  toolsExecuted.push("get_recent_context");
  const contextResult = await executeMcpTool("get_recent_context", {}, { userId });
  const recentContext = (contextResult.data as {
    recentSummaries: string[];
    activePrayers: string[];
    memories: Record<string, string>;
  }) || { recentSummaries: [], activePrayers: [], memories: {} };
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

  // 5. Execute MCP Scripture Search — enriched with the believer's own words, not just the topic bucket
  toolsExecuted.push("search_scripture");
  const scriptureToolResult = await executeMcpTool("search_scripture", {
    topic_or_keyword: `${template.scriptureQuery} ${userMessage}`,
  });

  const scriptures: ScriptureVerse[] = (scriptureToolResult.data as { verses: ScriptureVerse[] })?.verses || [];
  const primaryVerse = scriptures[0];

  // 6. Check if user explicitly asked for prayer or mentioned a prayer request
  let savedPrayerId: string | undefined;
  if (/pray|prayer|interced|please pray|hold in prayer/.test(lowerMsg)) {
    toolsExecuted.push("save_prayer_request");
    const prayerRes = await executeMcpTool("save_prayer_request", {
      text: userMessage,
      session_id: sessionId,
    }, { userId, sessionId });

    if (prayerRes.success) {
      savedPrayerId = (prayerRes.data as { id: string }).id;
    }
  }

  // 7. Check Active MCP Client Connection
  const mcpStatus = getActiveMcpClient();
  const mcpInfo = {
    isConnected: mcpStatus.isConnected,
    clientName: mcpStatus.clientName,
    transport: mcpStatus.transport,
    toolsCalled: toolsExecuted,
  };

  // 8. Model Selection Hierarchy:
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
${contextLines.join(" ")}`;

  let replyText = "";
  let usedModel: "gemini" | "ollama" | "local-offline-engine" = "local-offline-engine";
  let activePrayer = template.prayer;

  const geminiReply = await tryGeminiChat(userMessage, pastoralSystemPrompt);
  if (geminiReply) {
    replyText = geminiReply;
    usedModel = "gemini";
    const dynamicTurn = generateDynamicPastoralResponse(userMessage, scriptures, {
      preferredName,
      activePrayers: recentContext.activePrayers,
      recentSummaries: recentContext.recentSummaries,
    });
    activePrayer = dynamicTurn.prayer;
  } else {
    const ollamaReply = await tryOllamaChat(userMessage, pastoralSystemPrompt);
    if (ollamaReply) {
      replyText = ollamaReply;
      usedModel = "ollama";
      const dynamicTurn = generateDynamicPastoralResponse(userMessage, scriptures, {
        preferredName,
        activePrayers: recentContext.activePrayers,
        recentSummaries: recentContext.recentSummaries,
      });
      activePrayer = dynamicTurn.prayer;
    } else {
      // 9. Robust Dynamic Pastoral Reasoning Engine (zero external dependencies)
      // Generates deeply contextual, non-generic, empathetic responses tailored directly to the user's burden
      usedModel = "local-offline-engine";
      const dynamicTurn = generateDynamicPastoralResponse(userMessage, scriptures, {
        preferredName,
        activePrayers: recentContext.activePrayers,
        recentSummaries: recentContext.recentSummaries,
      });
      replyText = dynamicTurn.reply;
      activePrayer = dynamicTurn.prayer;
    }
  }

  // 10. Persist Assistant Response in SQLite with MCP Metadata
  saveMessage(sessionId, "assistant", replyText, {
    scriptures,
    prayer: activePrayer,
    usedModel,
    savedPrayerId,
    mcp: mcpInfo,
  });

  return {
    reply: replyText,
    scriptures,
    prayer: activePrayer,
    safety,
    savedPrayerId,
    usedModel,
    mcp: mcpInfo,
  };
}
